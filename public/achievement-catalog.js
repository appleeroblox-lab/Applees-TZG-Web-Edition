export const RARITIES={Common:'#A9B0BC',Uncommon:'#54CB83',Rare:'#4CAAFF',Epic:'#A879F3',Legendary:'#FFCA4D',Mythic:'#FF6E81',Celestial:'#5BDEE5',Cosmic:'#E28AFF'};
const groups=['Flight & Piloting','Warp & Space Travel','Planetary Exploration','Mining & Resources','Crafting & Inventory','Economy & Trading','XP & Leveling','Social & Loyalty'];
const rows=`First Ignition|Launch a spaceship|Common|106|0|1
Atmospheric Flyer|Fly 100 km in atmospheres|Common|212|0|100000
Cloud Surfer|Fly 500 km in atmospheres|Uncommon|261|4|500000
Reentry Rookie|Complete 10 atmospheric reentries|Uncommon|523|9|10
Surface Navigator|Fly 250 km below 800 m altitude|Rare|300|12|250000
Landing Expert|Complete 100 successful landings|Rare|600|25|100
Reentry Veteran|Complete 250 atmospheric reentries|Epic|475|27|250
Boost Veteran|Accumulate 10 hours of active boost use|Epic|950|55|36000
Master Pilot|Accumulate 150 hours of active manual flight|Legendary|900|80|540000
Eternal Aviator|Accumulate 500 hours of active manual flight|Cosmic|900|175|1800000
First Warp|Complete your first successful warp|Common|318|0|1
Warp Apprentice|Complete 25 successful warps|Uncommon|785|14|25
Warp Specialist|Complete 100 successful warps|Rare|900|37|100
Interstellar Traveler|Complete 25 interstellar warps|Rare|1200|50|25
Warp Commander|Complete 500 successful warps|Epic|1425|82|500
Void Drifter|Spend 24 active hours in deep space|Epic|1900|110|86400
Starway Veteran|Complete 250 interstellar warps|Legendary|1800|160|250
Warp Legend|Complete 2500 successful warps|Mythic|1200|150|2500
Interstellar Master|Unlock every public star system|Celestial|1090|154|13
Eternal Warp|Complete 10000 successful warps|Cosmic|1800|350|10000
First Landing|Land on a planet|Common|424|0|1
Moon Walker|Land on a moon|Common|106|0|1
Planet Hopper|Land on 3 unique planets|Uncommon|1047|19|3
Lunar Tourist|Land on 5 unique moons|Rare|300|12|5
Alien Explorer|Land on an exoplanet|Rare|600|25|1
World Surveyor|Visit 10 unique landable bodies|Epic|475|27|10
Atmosphere Expert|Land on 10 different atmospheric worlds|Epic|950|55|10
System Surveyor|Visit every landable body in one public system|Legendary|2700|240|1
Celestial Pathfinder|Visit 30 distinct landable bodies|Mythic|2400|300|30
Universal Explorer|Visit all public landable bodies|Cosmic|2700|525|96
First Mineral|Mine your first resource|Common|212|0|1
Ore Collector|Mine 250 resource units|Common|318|0|250
Miner Apprentice|Mine 1000 resource units|Uncommon|261|4|1000
Resource Hunter|Mine on 5 different celestial bodies|Rare|900|37|5
Rare Find|Mine 50 rare resource units|Rare|1200|50|50
Industrial Miner|Mine 10000 resource units|Epic|1425|82|10000
Interstellar Miner|Mine in 3 different public star systems|Epic|1900|110|3
Mining Tycoon|Mine 50000 resource units|Legendary|3600|320|50000
Universal Geologist|Collect every currently obtainable mineral type|Celestial|2181|309|48
Mining Legend|Mine 250000 resource units|Cosmic|3600|700|250000
First Creation|Craft your first item|Common|424|0|1
Workshop Beginner|Craft 25 items|Common|106|0|25
Tool Maker|Craft 5 distinct tool types|Uncommon|523|9|5
Skilled Crafter|Craft 100 items|Rare|300|12|100
Self-Sufficient|Craft 100 items using self-mined materials|Rare|600|25|100
Production Expert|Craft 1000 items|Epic|475|27|1000
Interplanetary Crafter|Craft using resources from 3 planets|Epic|950|55|3
Master Craftsman|Craft 5000 items|Legendary|900|80|5000
Recipe Collector|Craft every currently available recipe|Celestial|3272|463|31
Creation Legend|Craft 25000 items|Cosmic|900|175|25000
First Earnings|Earn 100 FP from gameplay|Common|212|0|100
First RocketCoin|Earn 1 RC from gameplay|Common|318|0|1
First Trade|Complete a legitimate trade|Uncommon|785|14|1
Space Merchant|Complete 25 legitimate trades|Rare|900|37|25
Wealth Builder|Earn 25000 FP from gameplay|Rare|1200|50|25000
Trading Expert|Complete 250 legitimate trades|Epic|1425|82|250
RC Collector|Earn 500 RC from gameplay|Epic|1900|110|500
Space Tycoon|Earn 250000 FP from gameplay|Legendary|1800|160|250000
Master Merchant|Complete 2000 legitimate trades|Mythic|3600|450|2000
Economic Legend|Earn 1000000 FP from gameplay|Cosmic|1800|350|1000000
Newcomer|Reach Level 5|Common|424|0|5
Space Traveler|Reach Level 10|Uncommon|1047|19|10
Star Explorer|Reach Level 20|Rare|300|12|20
Experienced Voyager|Reach Level 30|Rare|600|25|30
Elite Pilot|Reach Level 40|Epic|475|27|40
Star Commander|Reach Level 50|Epic|950|55|50
Cosmic Veteran|Reach Level 60|Legendary|2700|240|60
Master Navigator|Reach Level 75|Mythic|4800|600|75
Universe Veteran|Reach Level 90|Celestial|4363|618|90
Level Master|Reach Level 100|Cosmic|2700|525|100
First Friend|Make your first accepted friendship|Common|106|0|1
First Party|Join or create a party|Common|214|0|1
Party Explorer|Visit 3 planets while in a party|Uncommon|268|8|3
Returning Astronaut|Play on 7 different days|Rare|900|37|7
Space Companion|Spend 10 active hours in parties|Rare|1200|54|36000
Loyal Explorer|Play on 30 different days|Epic|1425|82|30
Team Voyager|Visit 15 different bodies with a party|Epic|1900|114|15
Community Veteran|Play on 100 different days|Legendary|3600|320|100
Dedicated Astronaut|Play on 365 different days|Celestial|1094|156|365
Community Legend|Play on 730 different days|Cosmic|3600|700|730`;
export const ACHIEVEMENTS=rows.split('\n').map((row,i)=>{const [name,requirement,rarity,fp,rc,target]=row.split('|');return Object.freeze({id:String(i+1).padStart(3,'0'),category:groups[Math.floor(i/10)],name,requirement,rarity,fp:+fp,rc:+rc,target:+target,icon:['🚀','🌀','🪐','⛏','🛠','💰','⭐','🤝'][Math.floor(i/10)]})});
if(ACHIEVEMENTS.length!==80||ACHIEVEMENTS.reduce((n,a)=>n+a.fp,0)!==100000||ACHIEVEMENTS.reduce((n,a)=>n+a.rc,0)!==10000)throw Error('Invalid achievement catalog totals');
