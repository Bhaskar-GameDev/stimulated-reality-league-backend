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
  "Afghanistan": "Afghanistan",
  "Nepal": "Nepal"
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
    "Kamindu Mendis": "PHKD Mendis",
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
  "Bangladesh": {
    "Litton Das": "Liton Das",
    "Najmul Hossain Shanto": "Nazmul Hossain Shanto"
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
  "Netherlands": {
    "Max O'Dowd": "MP O'Dowd",
    "Bas de Leede": "BFW de Leede",
    "Scott Edwards": "SA Edwards",
    "Sybrand Engelbrecht": "SA Engelbrecht",
    "Teja Nidamanuru": "AT Nidamanuru",
    "Logan van Beek": "LV van Beek",
    "Tim Pringle": "TJG Pringle",
    "Paul van Meekeren": "PA van Meekeren",
    "Vivian Kingma": "VJ Kingma",
    "Aryan Dutt": "A Dutt"
  },
  "Nepal": {
    "Kushal Bhurtel": "K Bhurtel",
    "Rohit Paudel": "RK Paudel",
    "Dipendra Singh Airee": "DS Airee",
    "Sundeep Jora": "S Jora",
    "Gulshan Jha": "Gulsan Jha",
    "Sandeep Lamichhane": "S Protestant",
    "Lalit Rajbanshi": "LN Rajbanshi"
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
let savedLineups = JSON.parse(fs.readFileSync('saved_lineups.json', 'utf8'));

const teamNameCounts = new Map();
for (const group in teamsJson) {
  for (const team in teamsJson[group]) {
    teamNameCounts.set(team, (teamNameCounts.get(team) || 0) + 1);
  }
}

const lines = inputData.trim().split('\n');
let currentTeam = null;
let currentTeamPlayers = [];

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;

  const knownTeams = ["India", "Australia", "England", "Pakistan", "South Africa", "New Zealand", "Afghanistan", "Bangladesh", "Sri Lanka", "West Indies", "Netherlands", "Nepal", "USA"];
  const isTeamLine = trimmed.match(/^[\uD83C-\uDBFF\uDC00-\uDFFF].*/) || knownTeams.includes(trimmed);

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

      const displayName = teamKey 
          ? (teamNameCounts.get(teamKey) > 1 ? `${teamKey} (men)` : teamKey)
          : `${currentTeam} (men)`;

      const squad = teamKey ? teamsJson.men[teamKey] : [];
      const selectedIds = [];

      for (let i = 0; i < currentTeamPlayers.length; i++) {
        const playerName = currentTeamPlayers[i];
        let targetName = playerName;
        if (playerMappings[currentTeam] && playerMappings[currentTeam][playerName]) {
          targetName = playerMappings[currentTeam][playerName];
        }

        let player = squad.find(p => p.name.toLowerCase() === targetName.toLowerCase());
        if (!player) {
            player = squad.find(p => p.name.toLowerCase().includes(targetName.toLowerCase()) || targetName.toLowerCase().includes(p.name.toLowerCase()));
        }
        
        if (player) {
          selectedIds.push(player.id);
        } else {
          const existingLineup = savedLineups[displayName];
          const fallbackId = (existingLineup && existingLineup[i]) || buildPlayerId(displayName, targetName, i);
          selectedIds.push(fallbackId);
          if (teamKey) {
              console.warn(`Could not find player: ${playerName} (target: ${targetName}) in team: ${teamKey}. Using: ${fallbackId}`);
          }
        }
      }
      
      savedLineups[displayName] = selectedIds;
      console.log(`Updated local lineup for ${displayName}`);
      currentTeamPlayers = [];
    }
  }
}

fs.writeFileSync('saved_lineups.json', JSON.stringify(savedLineups, null, 2));
console.log('Update complete.');
