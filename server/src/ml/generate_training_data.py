"""
Generates historical civic resolution dataset for training Nagrik Sahayak SLA regression models.
Reflects realistic civic governance operations and variance across departments and priorities.
"""

import json
import random
import os

random.seed(42)

DEPARTMENTS = [
    {"code": "WATER", "category": "Water Supply", "base_hours": 28, "std": 8},
    {"code": "ELEC", "category": "Electricity", "base_hours": 18, "std": 6},
    {"code": "ROAD", "category": "Roads and Infrastructure", "base_hours": 72, "std": 18},
    {"code": "SANI", "category": "Sanitation and Waste Management", "base_hours": 20, "std": 7},
    {"code": "HEALTH", "category": "Public Health", "base_hours": 36, "std": 10},
    {"code": "EDU", "category": "Education", "base_hours": 50, "std": 14},
    {"code": "SAFETY", "category": "Public Safety", "base_hours": 22, "std": 8},
    {"code": "TRANS", "category": "Transport", "base_hours": 40, "std": 12},
    {"code": "GEN", "category": "Other", "base_hours": 60, "std": 16},
]

PRIORITY_MULTIPLIERS = {
    "Urgent": 0.45,  # Expedited field dispatch
    "High": 0.75,
    "Medium": 1.00,
    "Low": 1.40,
}

ZONES = ["North", "South", "East", "West", "Central"]

SAMPLE_COMPLAINTS = {
    "Water Supply": [
        "Water pipeline burst and flooding main road near community center.",
        "Contaminated tap water with dark color and foul odor in residential block.",
        "Low water pressure in municipal pipeline during morning hours.",
        "Underground sewage pipe leak spilling onto pedestrian walkway."
    ],
    "Electricity": [
        "Overhead transformer sparking with loud noise near residential market.",
        "Street lights not operational for 4 consecutive nights on bypass road.",
        "Damaged feeder pillar box with exposed live wires near school.",
        "Frequent voltage fluctuations damaging home electrical equipment."
    ],
    "Roads and Infrastructure": [
        "Massive pothole crater on arterial road causing vehicle damage.",
        "Damaged asphalt road surface with deep ruts after heavy monsoon.",
        "Missing iron manhole cover on central boulevard creating hazard.",
        "Broken concrete pavement stones causing pedestrian tripping hazard."
    ],
    "Sanitation and Waste Management": [
        "Overflowing community garbage dumpster not emptied for five days.",
        "Illegal open debris and construction waste dumped along ring road.",
        "Blocked street rainwater drain overflowing into nearby shops.",
        "Dead animal carcass on secondary road causing health hazard."
    ],
    "Public Health": [
        "Severe mosquito breeding in stagnant water pool near public health dispensary.",
        "Unhygienic open food stalls near market without health inspection.",
        "Stray dogs pack aggressive behavior near neighborhood children park.",
        "Lack of disinfectant spraying after local viral fever outbreak."
    ],
    "Education": [
        "Broken boundary wall and collapsed fencing of municipal primary school.",
        "Drinking water filtration unit not functioning in school building.",
        "Dangerous tree branches hanging low over school play area.",
        "Damaged classroom ceiling plaster threatening safety of students."
    ],
    "Public Safety": [
        "Dark blind alley without streetlights causing safety concerns at night.",
        "Non-functional traffic signal at major four-way junction.",
        "Encroachment on pedestrian footpaths forcing commuters onto busy highway.",
        "Broken public safety surveillance camera pole on junction."
    ],
    "Transport": [
        "Damaged municipal bus stop shelter with missing metal roof.",
        "City bus service skipping designated stop during peak morning hours.",
        "Illegal auto-rickshaw parking blocking entrance of metro station.",
        "Faded zebra crossing and missing pedestrian warning signage."
    ],
    "Other": [
        "Delay in issuance of trade license renewal certificate.",
        "Discrepancy in property tax assessment record.",
        "Tree roots damaging underground residential water pipeline connection.",
        "Public park irrigation pump defective and unattended."
    ]
}

def generate_records(num_records=1000):
    records = []
    
    for i in range(num_records):
        dept_info = random.choice(DEPARTMENTS)
        category = dept_info["category"]
        dept_code = dept_info["code"]
        
        # Priority distribution: Urgent 15%, High 30%, Medium 40%, Low 15%
        priority = random.choices(
            ["Urgent", "High", "Medium", "Low"],
            weights=[0.15, 0.30, 0.40, 0.15]
        )[0]
        
        zone = random.choice(ZONES)
        
        # Select sample description and add random variations
        base_desc = random.choice(SAMPLE_COMPLAINTS[category])
        extra_words = random.randint(5, 50)
        desc_len = len(base_desc) + (extra_words * 6)
        
        # Compute realistic resolution hours with realistic variance
        base_h = dept_info["base_hours"]
        std_h = dept_info["std"]
        mult = PRIORITY_MULTIPLIERS[priority]
        
        # Longer descriptions slightly correlate with more complex issues
        complexity_factor = 1.0 + (min(desc_len, 400) / 2000.0)
        
        # Random noise (normal distribution)
        noise = random.gauss(0, std_h * 0.35)
        
        res_hours = (base_h * mult * complexity_factor) + noise
        res_hours = max(4.0, min(140.0, round(res_hours, 2)))
        
        records.append({
            "record_id": f"HIST-{2025}-{10000 + i}",
            "category": category,
            "department": dept_code,
            "priority": priority,
            "zone": zone,
            "description_length": desc_len,
            "resolution_hours": res_hours
        })
        
    return records

if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "historical_grievances.json")
    
    data = generate_records(1000)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        
    print(f"Generated {len(data)} realistic historical records at {out_path}")
