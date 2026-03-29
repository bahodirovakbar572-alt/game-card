import express from 'express';
import cors from 'cors';
import fs from 'fs';
import multer from 'multer'; // Rasm yuklash uchun
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('./'));
app.use('/uploads', express.static('uploads')); // Rasmlarni ko'rish uchun yo'l

// Rasmlarni 'uploads' papkasiga saqlash sozlamalari
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');
        cb(null, './uploads');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

const DB_FILE = './gamers_db.json';
let gamers = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];

// RO'YXATDAN O'TISH (Rasm bilan)
app.post('/api/register', upload.single('evidence'), (req, res) => {
    const { nick, game, winrate } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "Iltimos, statistika skrinshotini yuklang!" });
    if (gamers.find(g => g.nick === nick)) return res.status(400).json({ error: "Bu nickname band!" });

    const newID = Math.floor(1000000 + Math.random() * 9000000).toString();
    
    // Admin tasdiqlamaguncha rank va winrate-ni "Pending" qilishimiz yoki kiritilganini saqlashimiz mumkin
    // Hozircha kiritilganini saqlaymiz, lekin status qo'shamiz
    const newGamer = { 
        id: newID, 
        nick, 
        game, 
        winrate: parseInt(winrate), 
        rank: getRank(winrate),
        proof: file.path,
        status: 'verified' // Keyinchalik admin paneli qilsangiz buni 'pending' qilasiz
    };

    gamers.push(newGamer);
    fs.writeFileSync(DB_FILE, JSON.stringify(gamers, null, 2));
    res.json({ message: "Ro'yxatdan o'tdingiz!", gamer: newGamer });
});

function getRank(wr) {
    if(wr > 90) return 'IMMORTAL';
    if(wr > 75) return 'PLATINUM';
    if(wr > 50) return 'GOLD';
    if(wr > 25) return 'SILVER';
    return 'BRONZE';
}

// LOGIN QISMI (Oldingidek qoladi...)
app.post('/api/login', (req, res) => {
    const { gamerID } = req.body;
    const user = gamers.find(g => g.id === gamerID);
    if (!user) return res.status(404).json({ error: "Bunday ID topilmadi!" });

    const rankPower = { 'IMMORTAL': 5, 'PLATINUM': 4, 'GOLD': 3, 'SILVER': 2, 'BRONZE': 1 };
    const sortedLeaderboard = [...gamers].sort((a, b) => {
        if (rankPower[b.rank] !== rankPower[a.rank]) return rankPower[b.rank] - rankPower[a.rank];
        return b.winrate - a.winrate;
    });

    res.json({ user, leaderboard: sortedLeaderboard });
});

// O'yin turi bo'yicha reytingni olish API
app.get('/api/leaderboard/:game', (req, res) => {
    const { game } = req.params;
    
    // Faqat tanlangan o'yindagi geymerlarni ajratib olish
    const filteredGamers = gamers.filter(g => g.game === game);

    // Rank va Winrate bo'yicha saralash
    const rankPower = { 'IMMORTAL': 5, 'PLATINUM': 4, 'GOLD': 3, 'SILVER': 2, 'BRONZE': 1 };
    filteredGamers.sort((a, b) => {
        if (rankPower[b.rank] !== rankPower[a.rank]) return rankPower[b.rank] - rankPower[a.rank];
        return b.winrate - a.winrate;
    });

    res.json(filteredGamers);
});

app.listen(3000, () => console.log('Server: http://localhost:3000'));