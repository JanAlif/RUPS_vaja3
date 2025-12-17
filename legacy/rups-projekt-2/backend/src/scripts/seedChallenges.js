// backend/src/scripts/seedChallenges.js
import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import { Challenge } from "../models/Challenge.js";

dotenv.config();

async function seedChallenges() {
  try {
    await connectDB();

    // Po želji najprej počistimo stare
    await Challenge.deleteMany({}); 

    const challenges = [
      {
        orderIndex: 0,
        difficulty: "easy",
        pointsMultiplier: 1,
        prompt: "Sestavi preprosti električni krog z baterijo in svetilko.",
        requiredComponents: [
          "baterija",
          "svetilka",
          "žica",
          "žica",
          "žica",
          "žica",
          "žica",
          "žica",
        ],
        theory: [
          "Osnovni električni krog potrebuje vir, to je v našem primeru baterija. Potrebuje tudi porabnike, to je svetilka. Električni krog je v našem primeru sklenjen, kar je nujno potrebno, da električni tok teče preko prevodnikov oziroma žic."
        ],
      },
      {
        orderIndex: 1,
        difficulty: "easy",
        pointsMultiplier: 1,
        prompt: "Sestavi preprosti nesklenjeni električni krog z baterijo, svetilko in stikalom.",
        requiredComponents: ["baterija", "svetilka", "žica", "stikalo-off"],
        theory: [
          "V nesklenjenem krogu je stikalo odprto, kar pomeni, da je električni tok prekinjen. Svetilka posledično zato ne sveti."
        ],
      },
      {
        orderIndex: 2,
        difficulty: "easy",
        pointsMultiplier: 1,
        prompt: "Sestavi preprosti sklenjeni električni krog z baterijo, svetilko in stikalom.",
        requiredComponents: ["baterija", "svetilka", "žica", "stikalo-on"],
        theory: [
          "V sklenjenem krogu je stikalo zaprto, kar pomeni, da lahko električni tok teče neovirano. Torej v tem primeru so vrata zaprta."
        ],
      },
      {
        orderIndex: 3,
        difficulty: "easy",
        pointsMultiplier: 1,
        prompt: "Sestavi električni krog z baterijo, svetilko in stikalom, ki ga lahko ugašaš in prižigaš.",
        requiredComponents: [
          "baterija",
          "svetilka",
          "žica",
          "stikalo-on",
          "stikalo-off",
        ],
        theory: [
          "Stikalo nam omogoča nadzor nad pretokom električnega toka. Ko je stikalo zaprto, tok teče in posledično svetilka sveti. Kadar pa je stikalo odprto, tok ne teče in se svetilka ugasne. To lahko primerjamo z vklapljanjem in izklapljanjem električnih naprav v naših domovih."
        ],
      },
      {
        orderIndex: 4,
        difficulty: "medium",
        pointsMultiplier: 1.5,
        prompt: "Sestavi krog z dvema baterijama in svetilko.",
        requiredComponents: ["baterija", "baterija", "svetilka", "žica"],
        theory: [
          "Kadar vežemo dve ali več baterij zaporedno, se napetosti seštevajo. Večja je napetost, večji je električni tok. V našem primeru zato svetilka sveti močneje."
        ],
      },
      {
        orderIndex: 5,
        difficulty: "medium",
        pointsMultiplier: 1.5,
        prompt: "V električni krog zaporedno poveži dve svetilki, ki ju priključiš na baterijo.",
        requiredComponents: ["baterija", "svetilka", "svetilka", "žica"],
        theory: [
          "V zaporedni vezavi teče isti električni tok skozi vse svetilke. Napetost baterije se porazdeli. Če ena svetilka preneha delovati, bo ta prekinila tok skozi drugo svetilko."
        ],
      },
      {
        orderIndex: 6,
        difficulty: "medium",
        pointsMultiplier: 1.5,
        prompt: "V električni krog vzporedno poveži dve svetilki, ki ju priključiš na baterijo.",
        requiredComponents: ["baterija", "svetilka", "svetilka", "žica"],
        theory: [
          "V vzporedni vezavi ima vsaka svetilka enako napetost kot baterija. Električni tok se porazdeli med svetilkami. Če ena svetilka preneha delovati, bo druga še vedno delovala."
        ],
      },
      {
        orderIndex: 7,
        difficulty: "medium",
        pointsMultiplier: 2, // lahko malo več
        prompt: "Sestavi električni krog s svetilko in uporom.",
        requiredComponents: ["baterija", "svetilka", "žica", "upor"],
        theory: [
          "Upor omejuje tok v krogu. Večji kot je upor, manjši je tok. Spoznajmo Ohmov zakon: tok (I) = napetost (U) / upornost (R). Svetilka bo svetila manj intenzivno, saj skozi njo teče manjši tok."
        ],
      },
    ];

    await Challenge.insertMany(challenges);
    console.log("✅ Challenges seeded.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding challenges:", err);
    process.exit(1);
  }
}

seedChallenges();