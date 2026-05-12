require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ROBLOX_GROUP_ID = process.env.ROBLOX_GROUP_ID || '605614866';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

// ==================================================
// MAP ยศ Roblox Group → Discord Role ID
// วิธีหา Role ID: เปิด Discord Developer Mode
// คลิกขวาที่ Role → Copy Role ID
// ==================================================
const RANK_TO_DISCORD_ROLE = {
  // Roblox Rank Name (ต้องตรงทุกตัวอักษร) : Discord Role ID
  'Founder & CEO | ประธานเจ้าหน้าที่บริหาร':             '1415972094587703297',
  'Deputy Founder | รองผู้ก่อตั้ง':                      '1451461927816527977',
  '[HDM] Head Discord Mod':                               '1480787133055897652',
  'Dev | ผู้พัฒนา':                                       '1415973186125828106',
  '[DM] Discord Mod':                                     '1475888119239938180',
  'Chief of the Defence Forces | ผู้บัญชาการทหารสูงสุด': '1502029473464189020',
  'Royal Thai Headquarter | กองบัญชาการกองทัพไทย':       '1415980467643088946',
  'Royal Thai Army Headquarters | กองบัญชาการกองทัพบก':  '1415981072016998410',
  'Marshal | จอมพล':                                      '1415981357213159467',
  'General | นายทหารชั้นนายพล':                          '1415981549362483240',
  'Commissioned | นายทหารชั้นนายร้อย':                   '1415982059536650240',
  'Non-Commissioned | นายทหารชั้นประทวน':                '1415982228223033344',
  // เพิ่มยศอื่นๆ ได้ตามต้องการ
};

// Role ที่ทุกคนได้เมื่อยืนยันสำเร็จ (Verified)
const VERIFIED_ROLE_ID = '1416143372397314170';

// --------------------------------------------------
// ดึง Roblox User ID จาก Username
// --------------------------------------------------
async function getRobloxUserId(username) {
  const res = await axios.post('https://users.roblox.com/v1/usernames/users', {
    usernames: [username],
    excludeBannedUsers: false
  });
  if (res.data.data.length === 0) return null;
  return res.data.data[0].id;
}

// --------------------------------------------------
// เช็คยศใน Roblox Group
// --------------------------------------------------
async function getRobloxGroupRank(userId) {
  const res = await axios.get(
    `https://groups.roblox.com/v1/users/${userId}/groups/roles`
  );
  const groups = res.data.data;
  const found = groups.find(g => String(g.group.id) === String(ROBLOX_GROUP_ID));
  if (!found) return null;
  return {
    rankName: found.role.name,
    rankValue: found.role.rank
  };
}

// --------------------------------------------------
// ให้ Discord Role ผ่าน Bot
// --------------------------------------------------
async function giveDiscordRole(discordUserId, roleId) {
  await axios.put(
    `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordUserId}/roles/${roleId}`,
    {},
    {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
}

// --------------------------------------------------
// API: ตรวจสอบและให้ Role
// --------------------------------------------------
app.post('/api/verify', async (req, res) => {
  const { robloxUsername, discordUserId } = req.body;

  if (!robloxUsername || !discordUserId) {
    return res.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  try {
    // 1. หา Roblox User ID
    const userId = await getRobloxUserId(robloxUsername);
    if (!userId) {
      return res.json({ success: false, message: `ไม่พบ username "${robloxUsername}" ใน Roblox` });
    }

    // 2. เช็คว่าอยู่ใน Group ไหม
    const rankInfo = await getRobloxGroupRank(userId);
    if (!rankInfo) {
      return res.json({
        success: false,
        notInGroup: true,
        message: `"${robloxUsername}" ยังไม่ได้เป็นสมาชิก Group กรุณาเข้าร่วมก่อน`,
        groupUrl: `https://www.roblox.com/groups/${ROBLOX_GROUP_ID}`
      });
    }

    // 3. ให้ Verified Role ทุกคน
    try {
      await giveDiscordRole(discordUserId, VERIFIED_ROLE_ID);
    } catch (e) {
      console.log('Verified role error:', e.message);
    }

    // 4. หา Discord Role ID ตามยศ
    const discordRoleId = RANK_TO_DISCORD_ROLE[rankInfo.rankName];
    if (discordRoleId && discordRoleId !== 'DISCORD_ROLE_ID_HERE') {
      await giveDiscordRole(discordUserId, discordRoleId);
    }

    return res.json({
      success: true,
      message: `ยืนยันสำเร็จ! ยศของคุณ: ${rankInfo.rankName}`,
      rank: rankInfo.rankName
    });

  } catch (err) {
    console.error(err.message);
    return res.json({ success: false, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`✅ Server รันอยู่ที่ http://localhost:${process.env.PORT || 3000}`);
});
