// ============================================================
// Unit Tests: CYP Collision Detector (Deterministic Layer 2)
// Zero AI, zero network — pure pharmacology logic.
// ============================================================

import { describe, it, expect } from 'vitest';
import { detectCollisions } from '../collision-detector';
import type { PatientInput, RiskLevel } from '../types';

// ---- Helpers --------------------------------------------------------

function makePatient(overrides: Partial<PatientInput> = {}): PatientInput {
  return {
    drugs: [],
    geneticProfile: {
      CYP3A4: 'normal',
      CYP2D6: 'normal',
      CYP2C19: 'normal',
      CYP2C9: 'normal',
    },
    ...overrides,
  };
}

// ---- Test Suites ----------------------------------------------------

describe('detectCollisions', () => {
  // ==== Baseline / Edge Cases ====

  describe('edge cases', () => {
    it('returns NONE risk for an empty drug list', () => {
      const result = detectCollisions(makePatient({ drugs: [] }));
      expect(result.overallRisk).toBe('NONE');
      expect(result.collisions).toHaveLength(0);
      expect(result.unmatchedDrugs).toHaveLength(0);
    });

    it('tracks unmatched drugs that are not in the CYP database', () => {
      const result = detectCollisions(makePatient({ drugs: ['magicpill', 'unicorn_dust'] }));
      expect(result.unmatchedDrugs).toContain('magicpill');
      expect(result.unmatchedDrugs).toContain('unicorn_dust');
      expect(result.overallRisk).toBe('NONE');
    });

    it('handles a single drug with no enzyme interactions', () => {
      const result = detectCollisions(makePatient({ drugs: ['aspirin'] }));
      expect(result.overallRisk).toBe('NONE');
      expect(result.unmatchedDrugs).toHaveLength(0);
    });

    it('handles a single drug with enzyme roles but no collision', () => {
      const result = detectCollisions(makePatient({ drugs: ['warfarin'] }));
      // Warfarin is a substrate on CYP2C9 and CYP3A4 — no inhibitor/inducer present
      expect(result.overallRisk).toBe('NONE');
    });
  });

  // ==== Substrate + Inhibitor Collisions ====

  describe('substrate + inhibitor collisions', () => {
    it('detects CRITICAL risk: warfarin (substrate) + fluconazole (strong CYP2C9 inhibitor)', () => {
      const result = detectCollisions(makePatient({ drugs: ['warfarin', 'fluconazole'] }));
      expect(result.overallRisk).toBe('CRITICAL');

      const cyp2c9 = result.collisions.find(c => c.enzyme === 'CYP2C9');
      expect(cyp2c9).toBeDefined();
      expect(cyp2c9!.riskLevel).toBe('CRITICAL');
      expect(cyp2c9!.substrates.length).toBeGreaterThan(0);
      expect(cyp2c9!.inhibitors.length).toBeGreaterThan(0);
    });

    it('detects HIGH risk: codeine (substrate) + fluoxetine (strong CYP2D6 inhibitor)', () => {
      const result = detectCollisions(makePatient({ drugs: ['codeine', 'fluoxetine'] }));
      // fluoxetine is a strong CYP2D6 inhibitor, codeine is a sensitive CYP2D6 substrate
      const cyp2d6 = result.collisions.find(c => c.enzyme === 'CYP2D6');
      expect(cyp2d6).toBeDefined();
      expect(cyp2d6!.riskLevel).toBe('CRITICAL');
    });

    it('detects HIGH risk: simvastatin (substrate) + diltiazem (moderate CYP3A4 inhibitor)', () => {
      const result = detectCollisions(makePatient({ drugs: ['simvastatin', 'diltiazem'] }));
      const cyp3a4 = result.collisions.find(c => c.enzyme === 'CYP3A4');
      expect(cyp3a4).toBeDefined();
      expect(cyp3a4!.riskLevel).toBe('HIGH');
    });

    it('detects collision with clopidogrel + omeprazole on CYP2C19', () => {
      const result = detectCollisions(makePatient({ drugs: ['clopidogrel', 'omeprazole'] }));
      const cyp2c19 = result.collisions.find(c => c.enzyme === 'CYP2C19');
      expect(cyp2c19).toBeDefined();
      expect(cyp2c19!.substrates.length).toBeGreaterThan(0);
      expect(cyp2c19!.inhibitors.length).toBeGreaterThan(0);
    });
  });

  // ==== Substrate + Inducer Collisions ====

  describe('substrate + inducer collisions', () => {
    it('detects HIGH risk: warfarin (substrate) + rifampin (strong CYP2C9 inducer)', () => {
      const result = detectCollisions(makePatient({ drugs: ['warfarin', 'rifampin'] }));
      const cyp2c9 = result.collisions.find(c => c.enzyme === 'CYP2C9');
      expect(cyp2c9).toBeDefined();
      expect(cyp2c9!.inducers.length).toBeGreaterThan(0);
      expect(['HIGH', 'CRITICAL']).toContain(cyp2c9!.riskLevel);
    });

    it('detects collision: simvastatin + carbamazepine (CYP3A4 inducer)', () => {
      const result = detectCollisions(makePatient({ drugs: ['simvastatin', 'carbamazepine'] }));
      const cyp3a4 = result.collisions.find(c => c.enzyme === 'CYP3A4');
      expect(cyp3a4).toBeDefined();
      expect(cyp3a4!.inducers.length).toBeGreaterThan(0);
    });
  });

  // ==== Multi-Drug Polypharmacy ====

  describe('polypharmacy scenarios', () => {
    it('Demo Case 1: warfarin + fluconazole + omeprazole + clopidogrel → CRITICAL', () => {
      const result = detectCollisions(makePatient({
        drugs: ['warfarin', 'fluconazole', 'omeprazole', 'clopidogrel'],
        geneticProfile: {
          CYP3A4: 'intermediate',
          CYP2D6: 'poor',
          CYP2C19: 'rapid',
          CYP2C9: 'intermediate',
        },
      }));
      expect(result.overallRisk).toBe('CRITICAL');
      expect(result.collisions.length).toBeGreaterThanOrEqual(2);
    });

    it('Demo Case 2: fluoxetine + codeine + tramadol → CRITICAL (CYP2D6 blockade)', () => {
      const result = detectCollisions(makePatient({
        drugs: ['fluoxetine', 'codeine', 'tramadol'],
      }));
      expect(result.overallRisk).toBe('CRITICAL');
      const cyp2d6 = result.collisions.find(c => c.enzyme === 'CYP2D6');
      expect(cyp2d6).toBeDefined();
      expect(cyp2d6!.substrates.length).toBeGreaterThanOrEqual(2);
      expect(cyp2d6!.inhibitors.length).toBeGreaterThanOrEqual(1);
    });

    it('handles drugs appearing on multiple enzymes', () => {
      // fluconazole inhibits CYP2C9, CYP2C19, CYP3A4
      const result = detectCollisions(makePatient({
        drugs: ['fluconazole', 'warfarin', 'clopidogrel', 'simvastatin'],
      }));
      // Should have collisions on at least CYP2C9 and CYP2C19
      const enzymesHit = result.collisions.map(c => c.enzyme);
      expect(enzymesHit).toContain('CYP2C9');
      expect(enzymesHit).toContain('CYP2C19');
    });
  });

  // ==== Phenoconversion ====

  describe('phenoconversion', () => {
    it('detects phenoconversion: fluoxetine (strong CYP2D6 inhibitor) shifts normal → poor', () => {
      const result = detectCollisions(makePatient({
        drugs: ['fluoxetine', 'codeine'],
        geneticProfile: {
          CYP3A4: 'normal',
          CYP2D6: 'normal',
          CYP2C19: 'normal',
          CYP2C9: 'normal',
        },
      }));
      expect(result.phenoconversions.length).toBeGreaterThan(0);
      const cyp2d6Shift = result.phenoconversions.find(p => p.enzyme === 'CYP2D6');
      expect(cyp2d6Shift).toBeDefined();
      expect(cyp2d6Shift!.originalPhenotype).toBe('normal');
      expect(cyp2d6Shift!.effectivePhenotype).toBe('poor');
    });

    it('does not phenoconvert if patient is already a poor metabolizer', () => {
      const result = detectCollisions(makePatient({
        drugs: ['fluoxetine', 'codeine'],
        geneticProfile: {
          CYP3A4: 'normal',
          CYP2D6: 'poor',
          CYP2C19: 'normal',
          CYP2C9: 'normal',
        },
      }));
      const cyp2d6Shift = result.phenoconversions.find(p => p.enzyme === 'CYP2D6');
      expect(cyp2d6Shift).toBeUndefined();
    });

    it('phenoconversion elevates overall risk from HIGH to CRITICAL', () => {
      // HIGH collision + phenoconversion = CRITICAL overall
      const result = detectCollisions(makePatient({
        drugs: ['fluoxetine', 'codeine'],
        geneticProfile: {
          CYP3A4: 'normal',
          CYP2D6: 'normal',
          CYP2C19: 'normal',
          CYP2C9: 'normal',
        },
      }));
      expect(result.overallRisk).toBe('CRITICAL');
    });
  });

  // ==== Risk Level Calculations ====

  describe('risk level calculations', () => {
    it('NONE: single substrate, no inhibitor or inducer', () => {
      const result = detectCollisions(makePatient({ drugs: ['codeine'] }));
      expect(result.overallRisk).toBe('NONE');
    });

    it('risk reason includes enzyme name and drug names', () => {
      const result = detectCollisions(makePatient({ drugs: ['warfarin', 'fluconazole'] }));
      const cyp2c9 = result.collisions.find(c => c.enzyme === 'CYP2C9');
      expect(cyp2c9).toBeDefined();
      expect(cyp2c9!.riskReason).toContain('CYP2C9');
      expect(cyp2c9!.riskReason.length).toBeGreaterThan(10);
    });
  });

  // ==== Output Structure ====

  describe('output structure', () => {
    it('returns all required fields in CollisionMap', () => {
      const result = detectCollisions(makePatient({ drugs: ['warfarin', 'fluconazole'] }));
      expect(result).toHaveProperty('collisions');
      expect(result).toHaveProperty('overallRisk');
      expect(result).toHaveProperty('phenoconversions');
      expect(result).toHaveProperty('unmatchedDrugs');
      expect(Array.isArray(result.collisions)).toBe(true);
      expect(Array.isArray(result.phenoconversions)).toBe(true);
      expect(Array.isArray(result.unmatchedDrugs)).toBe(true);
    });

    it('each collision has enzyme, substrates, inhibitors, inducers, riskLevel, riskReason', () => {
      const result = detectCollisions(makePatient({ drugs: ['warfarin', 'fluconazole'] }));
      for (const collision of result.collisions) {
        expect(collision).toHaveProperty('enzyme');
        expect(collision).toHaveProperty('substrates');
        expect(collision).toHaveProperty('inhibitors');
        expect(collision).toHaveProperty('inducers');
        expect(collision).toHaveProperty('riskLevel');
        expect(collision).toHaveProperty('riskReason');
      }
    });
  });
});
