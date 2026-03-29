import express from 'express';
import cors from 'cors';
import fs from 'fs';
import multer from 'multer'; 
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('./'));
app.use('/uploads', express.static('uploads')); 

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

// Ma'lumotlar bazasini o'qish funksiyasi
function getGamers() {
    if (!fs.existsSync(DB_FILE)) return [];
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

// Rankni hisoblash funksiyasi
function calculateRank(wr) {
    const score = parseInt(wr);
    if (score >= 90) return 'IMMORTAL';
    if (score >= 75) return 'PLATINUM';
    if (score >= 50) return 'GOLD';
    if (score >= 25) return 'SILVER';
    return 'BRONZE';
}

// 1. RO'YXATDAN O'TISH (Yagona va xatosiz)
app.post('/api/register', upload.single('evidence'), (req, res) => {
    try {
        const { nick, game, winrate } = req.body;
        const file = req.file;
        let gamers = getGamers();

        if (!file) return res.status(400).json({ error: "Statistika skrinshotini yuklang!" });
        if (gamers.find(g => g.nick.toLowerCase() === nick.toLowerCase())) {
            return res.status(400).json({ error: "Bu nickname band!" });
        }

        // 7 xonali tasodifiy ID yaratish
        const newID = Math.floor(1000000 + Math.random() * 9000000).toString();

        const newGamer = { 
            id: newID, 
            nick, 
            game, 
            winrate: parseInt(winrate), 
            rank: calculateRank(winrate),
            proof: file.path,
            status: 'verified' 
        };

        gamers.push(newGamer);
        fs.writeFileSync(DB_FILE, JSON.stringify(gamers, null, 2));

        console.log(`Ro'yxatdan o'tdi: ${nick}, ID: ${newID}`);
        
        // Frontendga javob qaytarish
        res.status(201).json({ 
            message: "Muvaffaqiyatli ro'yxatdan o'tdingiz!", 
            gamer: newGamer 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Serverda xatolik yuz berdi!" });
    }
});

// 2. TIZIMGA KIRISH (Login)
app.post('/api/login', (req, res) => {
    const { gamerID } = req.body;
    let gamers = getGamers();
    
    const user = gamers.find(g => g.id === gamerID);
    if (!user) return res.status(404).json({ error: "Bunday ID topilmadi!" });

    res.json({ user });
});

// 3. REYTING JADVALI (Leaderboard)
app.get('/api/leaderboard/:game', (req, res) => {
    const { game } = req.params;
    let gamers = getGamers();
    
    // Faqat tanlangan o'yindagi geymerlarni olish
    const filteredGamers = gamers.filter(g => g.game === game);

    // Rank va Winrate bo'yicha saralash
    const rankPower = { 'IMMORTAL': 5, 'PLATINUM': 4, 'GOLD': 3, 'SILVER': 2, 'BRONZE': 1 };
    
    filteredGamers.sort((a, b) => {
        if (rankPower[b.rank] !== rankPower[a.rank]) {
            return rankPower[b.rank] - rankPower[a.rank];
        }
        return b.winrate - a.winrate;
    });

    res.json(filteredGamers);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server ishlamoqda: http://localhost:${PORT}`);
});