# CYP Database — Instructions for Bio Major

## This file is yours to own: `cyp_database.json`

This JSON file is the **deterministic backbone** of the entire app. The collision detector reads from this file — no AI involved. If this file is wrong, the whole app is wrong.

## Current status: 10 starter drugs (demo-ready)
## Target: 60 drugs (see the prioritized list in polypgx-plan.html)

## How to add a drug

Each entry follows this format:

```json
"drug_name_lowercase": {
  "enzymes": [
    { "enzyme": "CYP2D6", "role": "substrate", "strength": "sensitive" },
    { "enzyme": "CYP2C19", "role": "inhibitor", "strength": "strong" }
  ],
  "clinical_note": "One sentence about the clinical danger"
}
```

### Fields:
- **enzyme**: One of `CYP3A4`, `CYP2D6`, `CYP2C19`, `CYP2C9`
- **role**: `substrate` | `inhibitor` | `inducer`
- **strength**: `strong` | `moderate` | `weak` | `sensitive`
- **clinical_note**: Optional. One sentence explaining why this matters.

### Sources (use in this order):
1. **Flockhart Table** (easiest): medicine.iu.edu → clinical pharmacology → drug interaction table
2. **FDA CYP Table** (official): fda.gov → search "drug interaction table CYP"

### Speed hack:
Use the Claude prompt from the team doc to generate entries, then cross-reference against Flockhart Table before accepting.

## Drugs still needed (prioritized):
- [ ] paroxetine, sertraline, citalopram, escitalopram, venlafaxine, duloxetine, amitriptyline
- [ ] haloperidol, quetiapine
- [ ] amlodipine, atorvastatin, carvedilol, amiodarone, digoxin
- [ ] esomeprazole, pantoprazole, ranitidine, metoclopramide
- [ ] erythromycin, clarithromycin, ciprofloxacin, ketoconazole, isoniazid
- [ ] tramadol, oxycodone, morphine, ibuprofen, celecoxib
- [ ] metformin, glipizide, glibenclamide, pioglitazone
- [ ] phenytoin, carbamazepine, phenobarbital, valproic acid
- [ ] cyclosporine, tacrolimus, sildenafil, trazodone
- [ ] alprazolam, diazepam, zolpidem, ondansetron
- [ ] dexamethasone, prednisolone, tamoxifen, ritonavir
