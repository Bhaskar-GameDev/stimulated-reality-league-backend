const fs = require('fs');
const path = require('path');

const inputData = `
🇮🇳 India
Rohit Sharma
Virat Kohli
Rishabh Pant
Suryakumar Yadav
Shivam Dube
Hardik Pandya
Ravindra Jadeja
Axar Patel
Kuldeep Yadav
Arshdeep Singh
Jasprit Bumrah
🇦🇺 Australia
David Warner
Travis Head
Mitchell Marsh
Glenn Maxwell
Marcus Stoinis
Tim David
Matthew Wade
Pat Cummins
Mitchell Starc
Adam Zampa
Josh Hazlewood
🏴 England
Phil Salt
Jos Buttler
Jonny Bairstow
Harry Brook
Liam Livingstone
Moeen Ali
Sam Curran
Chris Jordan
Jofra Archer
Adil Rashid
Mark Wood
🇵🇰 Pakistan
Mohammad Rizwan
Babar Azam
Usman Khan
Fakhar Zaman
Iftikhar Ahmed
Shadab Khan
Imad Wasim
Shaheen Afridi
Naseem Shah
Haris Rauf
Mohammad Amir
🇿🇦 South Africa
Quinton de Kock
Reeza Hendricks
Aiden Markram
Heinrich Klaasen
David Miller
Tristan Stubbs
Marco Jansen
Keshav Maharaj
Kagiso Rabada
Anrich Nortje
Tabraiz Shamsi
🇳🇿 New Zealand
Finn Allen
Devon Conway
Kane Williamson
Daryl Mitchell
Glenn Phillips
Mark Chapman
Mitchell Santner
Michael Bracewell
Tim Southee
Trent Boult
Lockie Ferguson
🇦🇫 Afghanistan
Rahmanullah Gurbaz
Ibrahim Zadran
Gulbadin Naib
Azmatullah Omarzai
Mohammad Nabi
Najibullah Zadran
Rashid Khan
Noor Ahmad
Naveen-ul-Haq
Fazalhaq Farooqi
Mujeeb Ur Rahman
🇧🇩 Bangladesh
Litton Das
Tanzid Hasan
Najmul Hossain Shanto
Towhid Hridoy
Shakib Al Hasan
Mahmudullah
Jaker Ali
Rishad Hossain
Taskin Ahmed
Mustafizur Rahman
Tanzim Hasan Sakib
🇱🇰 Sri Lanka
Pathum Nissanka
Kusal Mendis
Kamindu Mendis
Charith Asalanka
Angelo Mathews
Dasun Shanaka
Wanindu Hasaranga
Maheesh Theekshana
Matheesha Pathirana
Dilshan Madushanka
Nuwan Thushara
🌴 West Indies
Brandon King
Johnson Charles
Nicholas Pooran
Rovman Powell
Shimron Hetmyer
Sherfane Rutherford
Andre Russell
Romario Shepherd
Akeal Hosein
Alzarri Joseph
Gudakesh Motie
🇳🇱 Netherlands
Max O'Dowd
Vikramjit Singh
Bas de Leede
Scott Edwards
Sybrand Engelbrecht
Teja Nidamanuru
Logan van Beek
Tim Pringle
Paul van Meekeren
Vivian Kingma
Aryan Dutt
🇳🇵 Nepal
Kushal Bhurtel
Aasif Sheikh
Rohit Paudel
Kushal Malla
Dipendra Singh Airee
Sundeep Jora
Gulshan Jha
Sompal Kami
Karan KC
Sandeep Lamichhane
Lalit Rajbanshi
🇺🇸 USA
Steven Taylor
Monank Patel
Aaron Jones
Andries Gous
Nitish Kumar
Corey Anderson
Harmeet Singh
Milind Kumar
Ali Khan
Saurabh Netravalkar
Jasdeep Singh
`;

const teamMappings = {
  "USA": "United States of America",
  "Afghanistan": "Afghanistan"
};

const playerMappings = {
  "India": {
    "Rohit Sharma": "RG Sharma",
    "Virat Kohli": "V Kohli",
    "Rishabh Pant": "RR Pant",
    "Suryakumar Yadav": "SA Yadav",
    "Axar Patel": "AR Patel",
    "Hardik Pandya": "HH Pandya",
    "Ravindra Jadeja": "RA Jadeja",
    "Jasprit Bumrah": "JJ Bumrah",
    "Shivam Dube": "S Dube"
  },
  "Australia": {
    "David Warner": "DA Warner",
    "Travis Head": "TM Head",
    "Mitchell Marsh": "MR Marsh",
    "Glenn Maxwell": "GJ Maxwell",
    "Marcus Stoinis": "MP Stoinis",
    "Matthew Wade": "MS Wade",
    "Pat Cummins": "PJ Cummins",
    "Mitchell Starc": "MA Starc",
    "Josh Hazlewood": "JR Hazlewood",
    "Adam Zampa": "A Zampa",
    "Tim David": "TH David"
  },
  "England": {
    "Phil Salt": "PD Salt",
    "Jos Buttler": "JC Buttler",
    "Jonny Bairstow": "JM Bairstow",
    "Harry Brook": "HC Brook",
    "Liam Livingstone": "LS Livingstone",
    "Moeen Ali": "MM Ali",
    "Sam Curran": "SM Curran",
    "Chris Jordan": "CJ Jordan",
    "Jofra Archer": "JC Archer",
    "Adil Rashid": "AU Rashid",
    "Mark Wood": "MA Wood"
  },
  "Pakistan": {
    "Shaheen Afridi": "Shaheen Shah Afridi"
  },
  "Sri Lanka": {
    "Pathum Nissanka": "P Nissanka",
    "Kusal Mendis": "BKG Mendis",
    "Charith Asalanka": "KIC Asalanka",
    "Angelo Mathews": "AD Mathews",
    "Dasun Shanaka": "MD Shanaka",
    "Wanindu Hasaranga": "PWH de Silva",
    "Maheesh Theekshana": "M Theekshana",
    "Matheesha Pathirana": "M Pathirana",
    "Dilshan Madushanka": "D Madushanka",
    "Nuwan Thushara": "N Thushara"
  },
  "West Indies": {
    "Brandon King": "BA King",
    "Johnson Charles": "J Charles",
    "Nicholas Pooran": "N Pooran",
    "Rovman Powell": "R Powell",
    "Shimron Hetmyer": "SO Hetmyer",
    "Sherfane Rutherford": "SE Rutherford",
    "Andre Russell": "AD Russell",
    "Romario Shepherd": "R Shepherd",
    "Akeal Hosein": "AJ Hosein",
    "Alzarri Joseph": "AS Joseph",
    "Gudakesh Motie": "G Motie"
  },
  "United States of America": {
    "Steven Taylor": "SR Taylor",
    "Monank Patel": "MD Patel",
    "Andries Gous": "AGS Gous",
    "Nitish Kumar": "NR Kumar",
    "Corey Anderson": "CJ Anderson",
    "Saurabh Netravalkar": "SN Netravalkar"
  },
  "South Africa": {
    "Quinton de Kock": "Q de Kock",
    "Reeza Hendricks": "RR Hendricks",
    "Aiden Markram": "AK Markram",
    "Heinrich Klaasen": "H Klaasen",
    "David Miller": "DA Miller",
    "Tristan Stubbs": "T Stubbs",
    "Marco Jansen": "M Jansen",
    "Keshav Maharaj": "KA Maharaj",
    "Kagiso Rabada": "K Rabada",
    "Anrich Nortje": "A Nortje",
    "Tabraiz Shamsi": "T Shamsi"
  },
  "New Zealand": {
    "Finn Allen": "FH Allen",
    "Devon Conway": "DP Conway",
    "Kane Williamson": "KS Williamson",
    "Daryl Mitchell": "DJ Mitchell",
    "Glenn Phillips": "GD Phillips",
    "Mark Chapman": "MS Chapman",
    "Mitchell Santner": "MJ Santner",
    "Michael Bracewell": "MG Bracewell",
    "Tim Southee": "TG Southee",
    "Trent Boult": "TA Boult",
    "Lockie Ferguson": "LH Ferguson"
  },
  "Bangladesh": {
    "Najmul Hossain Shanto": "Nazmul Hossain Shanto"
  },
  "Netherlands": {
    "Max O'Dowd": "MP O'Dowd"
  }
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "player";
}

function buildPlayerId(teamName, playerName, index) {
  return `${slugify(teamName)}_${String(index + 1).padStart(2, "0")}_${slugify(playerName)}`;
}

const teamsJson = JSON.parse(fs.readFileSync('teams.json', 'utf8'));
const savedLineups = JSON.parse(fs.readFileSync('saved_lineups.json', 'utf8'));

const lines = inputData.trim().split('\n');
let currentTeam = null;
let currentTeamPlayers = [];

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;

  const isTeamLine = trimmed.match(/^[\uD83C-\uDBFF\uDC00-\uDFFF].*/) || 
                    ["India", "Australia", "England", "Pakistan", "South Africa", "New Zealand", "Afghanistan", "Bangladesh", "Sri Lanka", "West Indies", "Netherlands", "Nepal", "USA"].includes(trimmed);

  if (isTeamLine) {
    currentTeam = trimmed.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]/g, '').trim();
    if (teamMappings[currentTeam]) {
      currentTeam = teamMappings[currentTeam];
    }
    currentTeamPlayers = [];
    console.log(`Processing Team: ${currentTeam}`);
  } else {
    currentTeamPlayers.push(trimmed);
    if (currentTeamPlayers.length === 11) {
      let teamKey = Object.keys(teamsJson.men).find(k => k.toLowerCase() === currentTeam.toLowerCase());
      if (!teamKey) {
          teamKey = Object.keys(teamsJson.men).find(k => k.toLowerCase().includes(currentTeam.toLowerCase()));
      }

      if (teamKey) {
        const squad = teamsJson.men[teamKey];
        const selectedIds = [];
        
        for (const playerName of currentTeamPlayers) {
          let targetName = playerName;
          if (playerMappings[teamKey] && playerMappings[teamKey][playerName]) {
            targetName = playerMappings[teamKey][playerName];
          } else if (playerMappings[currentTeam] && playerMappings[currentTeam][playerName]) {
            targetName = playerMappings[currentTeam][playerName];
          }

          let player = squad.find(p => p.name.toLowerCase() === targetName.toLowerCase());
          if (!player) {
              player = squad.find(p => p.name.toLowerCase().includes(targetName.toLowerCase()) || targetName.toLowerCase().includes(p.name.toLowerCase()));
          }
          
          if (player) {
            const index = squad.indexOf(player);
            const id = player.id || buildPlayerId(teamKey, player.name, index);
            selectedIds.push(id);
          } else {
            console.warn(`Could not find player: ${playerName} (target: ${targetName}) in team: ${teamKey}`);
            selectedIds.push(buildPlayerId(teamKey, playerName, 99)); 
          }
        }
        
        const lineupKey = teamKey + " (men)";
        savedLineups[lineupKey] = selectedIds;
        console.log(`Updated lineup for ${lineupKey}`);
      } else {
        console.error(`Team not found in teams.json: ${currentTeam}`);
      }
    }
  }
}

fs.writeFileSync('saved_lineups.json', JSON.stringify(savedLineups, null, 2));
console.log('Update complete.');
