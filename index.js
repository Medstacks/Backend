const express = require('express');
const bcrypt = require('bcryptjs');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let users = [];
let crops = [];
let offers = [];

const preservationTips = [
  {
    crop: "Tomato",
    tips: [
      "Store in a cool dry place",
      "Avoid refrigeration if unripe",
      "Wrap in paper to absorb moisture"
    ]
  },
  {
    crop: "Maize",
    tips: [
      "Keep in airtight containers",
      "Dry thoroughly before storage",
      "Avoid humidity"
    ]
  },
  {
    crop: "Cassava",
    tips: [
      "Peel and freeze for longer storage",
      "Keep in a sack if storing short-term",
      "Avoid exposure to sunlight"
    ]
  }
];

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const validRoles = ['farmer', 'transporter', 'cold_storage'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  if (users.find(u => u.email === email)) {
    return res.status(400).json({ message: 'Email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { id: Date.now(), name, email, role, password: hashedPassword };
  users.push(user);
  res.status(201).json({ message: 'Registered successfully', userId: user.id });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  res.json({ message: 'Login successful', userId: user.id });
});

app.post('/crop', (req, res) => {
  const { userId, cropType, plantingDate, location, yieldEstimate } = req.body;
  const userExists = users.some(u => u.id === userId);
  if (!userExists) return res.status(404).json({ message: 'User not found' });

  const harvestDate = new Date(plantingDate);
harvestDate.setDate(harvestDate.getDate() + 90);

  const crop = {
    id: Date.now(),
    userId,
    cropType,
    plantingDate,
    yieldEstimate
  };
  crops.push(crop);
  res.status(201).json({ message: 'Crop data saved', crop });
});

app.get('/dashboard/upcoming-harvests', (req, res) => {
  const today = new Date();
  const upcomingHarvests = crops.filter(crop => {
    const harvestDate = new Date(crop.plantingDate);
    harvestDate.setMonth(harvestDate.getMonth() + 6);
    return harvestDate > today && harvestDate <= new Date(today.setMonth(today.getMonth() + 2));
  });
  res.json(upcomingHarvests);
});

app.get('/dashboard/clusters', (req, res) => {
  const clusters = [
    { id: 1, name: "Cluster A", farmers: 15, crops: "Maize, Beans" },
    { id: 2, name: "Cluster B", farmers: 20, crops: "Rice, Cassava" }
  ];
  res.json(clusters);
});

app.get('/dashboard/tips', (req, res) => {
  const tips = [
    "Water crops early in the morning to prevent evaporation.",
    "Check for pests regularly, especially after rainfall.",
    "Ensure proper spacing between crops to improve growth."
  ];
  res.json(tips);
});

app.get('/dashboard/alerts', (req, res) => {
  const alerts = [
    { id: 1, message: "Rainstorm expected in 2 days. Harvest early." },
    { id: 2, message: "Pests detected in your region. Check your crops." }
  ];
  res.json(alerts);
});

app.get('/tips/:crop', (req, res) => {
  const crop = req.params.crop.toLowerCase();
  const found = preservationTips.find(t => t.crop.toLowerCase() === crop);
  if (!found) return res.status(404).json({ message: 'No tips for this crop' });
  res.json(found);
});

app.get('/', (req, res) => {
  res.send('Backend is running!');
});

app.get('/farmer/:userId/harvests', (req, res) => {
  const userId = parseInt(req.params.userId);
  const now = new Date();

  const userCrops = crops.filter(c => c.userId === userId);

  const upcomingHarvests = userCrops.filter(crop => new Date(crop.harvestDate) > now);

  const clusters = [];
  const visited = new Set();

  for (let i = 0; i < userCrops.length; i++) {
    if (visited.has(userCrops[i].id)) continue;
    const cluster = [userCrops[i]];
    visited.add(userCrops[i].id);

    for (let j = i + 1; j < userCrops.length; j++) {
      const a = userCrops[i];
      const b = userCrops[j];
      const sameType = a.cropType === b.cropType;
      const sameLocation = a.location === b.location;
      const dateDiff = Math.abs(new Date(a.plantingDate) - new Date(b.plantingDate));
      const daysDiff = dateDiff / (1000 * 60 * 60 * 24);

      if (sameType && sameLocation && daysDiff <= 7) {
         cluster.push(b);
        visited.add(b.id);
      }
    }

    clusters.push(cluster);
  }

  res.json({
    upcomingHarvests,
    clusters
  });
});

app.post('/match', (req, res) => {
  const { farmerId, cropType, location } = req.body;

  const transporter = users.find(u => u.role === 'transporter');
  const coldStorage = users.find(u => u.role === 'cold_storage');

  if (!transporter || !coldStorage) {
    return res.status(404).json({ message: 'No match found' });
  }

  const offer = {
    id: Date.now(),
    farmerId,
    cropType,
    location,
    transporterId: transporter.id, 
    coldStorageId: coldStorage.id,
    status: 'pending'
  };

  offers.push(offer);
  res.status(201).json({ message: 'Match found and offer created', offer });
});

app.post('/offer/:id/response', (req, res) => {
  const { status } = req.body;
  const offer = offers.find(o => o.id == req.params.id);

  if (!offer) return res.status(404).json({ message: 'Offer not found' });
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  offer.status = status;
  res.json({ message: `Offer ${status}`, offer });
});
                            
function generateRiskScore(cropType, weatherCondition) {
  let risk = 0;
  if (cropType === "Maize") {
    if (weatherCondition === "Drought") risk = 80;
    else if (weatherCondition === "Rainstorm") risk = 60;
    else risk = 20;
  } else if (cropType === "Rice") {
    if (weatherCondition === "Flood") risk = 85;
    else if (weatherCondition === "Drought") risk = 70;
    else risk = 25;
  }
  return risk;
}

app.get('/dashboard/risk-score', (req, res) => {
  const { cropType, weatherCondition } = req.query;

  if (!cropType || !weatherCondition) {
    return res.status(400).json({ message: "Missing cropType or weatherCondition" });
  }

  const riskScore = generateRiskScore(cropType, weatherCondition);
  res.json({ riskScore });
});

app.get('/dashboard', (req, res) => {
  const today = new Date();
  const upcomingHarvests = crops.filter(crop => {
    const harvestDate = new Date(crop.plantingDate);
    harvestDate.setMonth(harvestDate.getMonth() + 6);
    return harvestDate > today && harvestDate <= new Date(today.setMonth(today.getMonth() + 2));
  });

  const data = {
    upcomingHarvests,
    clusters: [
      { id: 1, name: "Cluster A", farmers: 15, crops: "Maize, Beans" },
      { id: 2, name: "Cluster B", farmers: 20, crops: "Rice, Cassava" }
    ],
    tips: [
      "Water crops early in the morning to prevent evaporation.",
      "Check for pests regularly, especially after rainfall.",
      "Ensure proper spacing between crops to improve growth."
    ],
    alerts: [
      { id: 1, message: "Rainstorm expected in 2 days. Harvest early." },
      { id: 2, message: "Pests detected in your region. Check your crops." }
    ]
  };

  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});