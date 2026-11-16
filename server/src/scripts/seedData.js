/**
 * Nagrik Sahayak — Seed Initial Civic Departments, Demo Accounts, and Sample Grievances
 *
 * Usage:
 *   node server/src/scripts/seedData.js
 */

const mongoose = require('mongoose');
const config = require('../config/env');
const { connectDB } = require('../config/db');
const Department = require('../models/Department');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const { calculateDeadline, STANDARD_SLA_HOURS } = require('../services/slaService');

const INITIAL_DEPARTMENTS = [
  {
    name: 'Water Supply & Sewerage',
    code: 'WATER',
    description: 'Manages municipal potable water distribution, pipeline maintenance, sewage lines, and leak repair.',
    categories: ['Water Supply'],
    slaHours: { ...STANDARD_SLA_HOURS },
  },
  {
    name: 'Electricity & Energy',
    code: 'ELEC',
    description: 'Oversees power grid maintenance, transformers, street lighting, and live electrical wire safety.',
    categories: ['Electricity'],
    slaHours: { ...STANDARD_SLA_HOURS },
  },
  {
    name: 'Roads & Public Infrastructure',
    code: 'ROAD',
    description: 'Handles potholes, asphalt resurfacing, footpaths, bridges, drainage channels, and public civil works.',
    categories: ['Roads and Infrastructure'],
    slaHours: { ...STANDARD_SLA_HOURS },
  },
  {
    name: 'Sanitation & Waste Management',
    code: 'SANI',
    description: 'Responsible for daily garbage collection, public bins, street sweeping, dump sites, and cleanliness.',
    categories: ['Sanitation and Waste Management'],
    slaHours: { ...STANDARD_SLA_HOURS },
  },
  {
    name: 'Public Health & Healthcare',
    code: 'HEALTH',
    description: 'Supervises government dispensaries, vector-borne disease control (dengue, malaria), and food safety.',
    categories: ['Public Health'],
    slaHours: { ...STANDARD_SLA_HOURS },
  },
  {
    name: 'Education & Schools',
    code: 'EDU',
    description: 'Manages municipal schools, basic academic facilities, mid-day meals, and classroom infrastructure.',
    categories: ['Education'],
    slaHours: { ...STANDARD_SLA_HOURS },
  },
  {
    name: 'Public Safety & Law Enforcement',
    code: 'SAFETY',
    description: 'Coordinates with civil defence, municipal vigilance, dark spot illumination, and public safety.',
    categories: ['Public Safety'],
    slaHours: { ...STANDARD_SLA_HOURS },
  },
  {
    name: 'Transport & Traffic Management',
    code: 'TRANS',
    description: 'Maintains city buses, bus shelters, traffic signals, zebra crossings, and public parking zones.',
    categories: ['Transport'],
    slaHours: { ...STANDARD_SLA_HOURS },
  },
  {
    name: 'General Public Administration',
    code: 'GEN',
    description: 'General administrative grievances, municipal revenue, certificates, and unclassified civic matters.',
    categories: ['Other'],
    slaHours: { ...STANDARD_SLA_HOURS },
  },
];

async function seedData() {
  console.log('[Seed] Connecting to MongoDB...');
  await connectDB();

  // 1. Seed Departments
  const deptMap = {};
  for (const deptData of INITIAL_DEPARTMENTS) {
    let dept = await Department.findOne({
      $or: [{ code: deptData.code }, { name: deptData.name }],
    });
    if (!dept) {
      dept = await Department.create(deptData);
      console.log(`[Seed] Created department: ${dept.name} (${dept.code})`);
    } else {
      console.log(`[Seed] Department ${dept.name} already exists.`);
    }
    deptMap[deptData.code] = dept;
  }

  // 2. Seed Administrator Account
  const adminEmail = 'admin@nagriksahayak.gov.in';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      name: 'Chief Administrative Officer',
      email: adminEmail,
      password: 'AdminSecurePassword123!',
      role: 'admin',
      isActive: true,
    });
    console.log(`[Seed] Created Admin: ${admin.email}`);
  }

  // 3. Seed Department Officers
  const officerEmail = 'officer.water@nagriksahayak.gov.in';
  let officer = await User.findOne({ email: officerEmail });
  if (!officer) {
    officer = await User.create({
      name: 'Er. Rajesh Sharma',
      email: officerEmail,
      password: 'OfficerSecurePassword123!',
      role: 'officer',
      department: deptMap['WATER']._id,
      phone: '9871100223',
      isActive: true,
    });
    console.log(`[Seed] Created Officer: ${officer.email} (${deptMap['WATER'].name})`);

    // Assign as head officer of Water department
    deptMap['WATER'].headOfficer = officer._id;
    await deptMap['WATER'].save();
  }

  // 4. Seed Demo Citizen
  const citizenEmail = 'citizen.demo@example.com';
  let citizen = await User.findOne({ email: citizenEmail });
  if (!citizen) {
    citizen = await User.create({
      name: 'Anjali Gupta',
      email: citizenEmail,
      password: 'CitizenPassword123!',
      role: 'citizen',
      phone: '9812345678',
      address: 'House 42, Pocket B, Mayur Vihar, Delhi',
      isActive: true,
    });
    console.log(`[Seed] Created Citizen: ${citizen.email}`);
  }

  // 5. Seed Sample Complaints if none exist
  const existingCount = await Complaint.countDocuments();
  if (existingCount === 0) {
    const sampleComplaints = [
      {
        trackingId: 'NS-2026-10492',
        citizen: citizen._id,
        title: 'Severe drinking water pipeline breach on Main Road',
        description: 'Underground drinking water main line burst near metro pillar 45. Thousands of liters of water flooded the market street causing traffic paralysis and low pressure in residential taps.',
        category: 'Water Supply',
        department: deptMap['WATER']._id,
        location: {
          address: 'Opposite Metro Pillar 45, Main Market Road',
          pincode: '110091',
        },
        priority: 'High',
        status: 'In Progress',
        assignedOfficer: officer._id,
        slaDeadline: calculateDeadline('High', deptMap['WATER'].slaHours),
        aiAnalysis: {
          categorySuggestion: 'Water Supply',
          departmentSuggestion: 'Water Supply & Sewerage',
          prioritySuggestion: 'High',
          summary: 'Underground pipeline burst near Metro Pillar 45 causing extensive water wastage and street flooding.',
          nextAction: 'Dispatch emergency excavation crew and turn off secondary feeder valve.',
          confidence: 0.94,
          isFallback: true,
          analyzedAt: new Date(),
        },
        timeline: [
          {
            status: 'Submitted',
            changedBy: citizen._id,
            changedByName: citizen.name,
            changedByRole: 'citizen',
            notes: 'Citizen submitted grievance through public portal',
            timestamp: new Date(Date.now() - 36 * 3600 * 1000),
          },
          {
            status: 'Assigned',
            changedBy: admin._id,
            changedByName: admin.name,
            changedByRole: 'admin',
            notes: `Assigned to ${officer.name} (Water Supply & Sewerage)`,
            timestamp: new Date(Date.now() - 30 * 3600 * 1000),
          },
          {
            status: 'In Progress',
            changedBy: officer._id,
            changedByName: officer.name,
            changedByRole: 'officer',
            notes: 'Field team deployed with dewatering pumps and replacement pipes.',
            timestamp: new Date(Date.now() - 12 * 3600 * 1000),
          },
        ],
        comments: [
          {
            user: officer._id,
            userName: officer.name,
            userRole: 'officer',
            message: 'Repair work commenced at 09:30 AM. Expected completion by 06:00 PM.',
            isInternal: false,
            timestamp: new Date(Date.now() - 10 * 3600 * 1000),
          },
        ],
      },
      {
        trackingId: 'NS-2026-10493',
        citizen: citizen._id,
        title: 'Dangerous hanging electricity cable near primary school',
        description: 'Heavy storm snapped an overhead electricity cable which is hanging 4 feet above sidewalk right outside Government Primary School gate. High danger of electric shock to students.',
        category: 'Electricity',
        department: deptMap['ELEC']._id,
        location: {
          address: 'Outside Gate 1, Primary School, Ward 14',
          pincode: '110091',
        },
        priority: 'Urgent',
        status: 'Assigned',
        slaDeadline: calculateDeadline('Urgent', deptMap['ELEC'].slaHours),
        aiAnalysis: {
          categorySuggestion: 'Electricity',
          departmentSuggestion: 'Electricity & Energy',
          prioritySuggestion: 'Urgent',
          summary: 'Live overhead wire snapped near primary school entrance creating severe electric hazard.',
          nextAction: 'Alert local power sub-station linesman immediately to isolate circuit.',
          confidence: 0.98,
          isFallback: true,
          analyzedAt: new Date(),
        },
        timeline: [
          {
            status: 'Submitted',
            changedBy: citizen._id,
            changedByName: citizen.name,
            changedByRole: 'citizen',
            notes: 'Citizen filed urgent safety grievance',
            timestamp: new Date(Date.now() - 4 * 3600 * 1000),
          },
        ],
      },
      {
        trackingId: 'NS-2026-10490',
        citizen: citizen._id,
        title: 'Garbage accumulation and overflowing dumpsters cleared',
        description: 'Community garbage dumpster was not cleared for 5 consecutive days.',
        category: 'Sanitation and Waste Management',
        department: deptMap['SANI']._id,
        location: {
          address: 'Behind Community Center, Block C',
          pincode: '110091',
        },
        priority: 'Medium',
        status: 'Resolved',
        slaDeadline: calculateDeadline('Medium', deptMap['SANI'].slaHours),
        resolvedAt: new Date(Date.now() - 24 * 3600 * 1000),
        resolutionNotes: 'Compactor trucks cleared entire garbage backlog and sanitizing powder sprayed on the area.',
        timeline: [
          {
            status: 'Submitted',
            changedBy: citizen._id,
            changedByName: citizen.name,
            changedByRole: 'citizen',
            notes: 'Submitted by citizen',
            timestamp: new Date(Date.now() - 72 * 3600 * 1000),
          },
          {
            status: 'Resolved',
            changedBy: admin._id,
            changedByName: admin.name,
            changedByRole: 'admin',
            notes: 'Compactor trucks cleared entire garbage backlog and sanitizing powder sprayed.',
            timestamp: new Date(Date.now() - 24 * 3600 * 1000),
          },
        ],
      },
    ];

    for (const comp of sampleComplaints) {
      await Complaint.create(comp);
      console.log(`[Seed] Created sample complaint: ${comp.trackingId} (${comp.title})`);
    }
  }

  // 6. Safely associate any existing unassigned complaints with newly seeded departments
  const unassigned = await Complaint.find({ department: null });
  for (const comp of unassigned) {
    const matchedDept = Object.values(deptMap).find((d) => d.categories && d.categories.includes(comp.category));
    if (matchedDept) {
      comp.department = matchedDept._id;
      await comp.save();
      console.log(`[Seed] Associated unassigned complaint ${comp.trackingId} ("${comp.title}") with department: ${matchedDept.name}`);
    }
  }

  console.log(`
================================================================================
  NAGRIK SAHAYAK DATABASE SEEDING COMPLETED SUCCESSFULLY!
  
  Pre-configured Demo Accounts:
  1. System Administrator:
     Email:    admin@nagriksahayak.gov.in
     Password: AdminSecurePassword123!
     
  2. Water Department Officer:
     Email:    officer.water@nagriksahayak.gov.in
     Password: OfficerSecurePassword123!
     
  3. Registered Citizen:
     Email:    citizen.demo@example.com
     Password: CitizenPassword123!
================================================================================`);

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  seedData().catch((err) => {
    console.error('[Seed] Seeding error:', err.message);
    process.exit(1);
  });
}

module.exports = { seedData };
