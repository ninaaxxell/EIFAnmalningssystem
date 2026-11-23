
import { data, medlemsData, loadData } from "./data.js";


// Här sparas informationen från JSON-filerna
// Variablerna importeras från data.js


// Ladda information från båda JSON-filerna
export async function initializeRegistrations() {

    const success = await loadData();

    if (success) {

        // Visa aktiviteterna i rullgardinsmenyn
        displayActivities();

        console.log("Registreringssystemet har startat.");

    } else {

        showMessage("Kunde inte ladda informationen.", "error");

    }

}


// Visa alla aktiviteter i rullgardinsmenyn
export function displayActivities() {

    const select = document.getElementById("activitySelect");

    select.innerHTML = '<option value="">Välj aktivitet</option>';

    data.aktiviteter.forEach(function(activity) {

        const option = document.createElement("option");

        option.value = activity.id;
        option.textContent = activity.namn;

        select.appendChild(option);

    });

}


// Lägg till en deltagare i en aktivitet
export function addParticipant(activityId, memberNumber) {

    // Hitta aktiviteten
    const activity = data.aktiviteter.find(function(activity) {
        return activity.id === activityId;
    });

    if (activity === undefined) {
        return false;
    }

    // Kontrollera om medlemmen redan är anmäld
    if (activity.deltagare.includes(memberNumber)) {
        return false;
    }

    // Lägg till medlemsnumret
    activity.deltagare.push(memberNumber);

    // Uppdatera antalet anmälda
    updateParticipantCount(activity);

    return true;

}


// Uppdatera antalet anmälda deltagare
function updateParticipantCount(activity) {

    activity.antal_anmälda = activity.deltagare.length;

}


// Anmäl en medlem till en aktivitet
export function registerMember(activityId, memberNumber) {

    // Hitta aktiviteten med hjälp av aktivitetens ID
    const activity = data.aktiviteter.find(function(activity) {
        return activity.id === activityId;
    });

    // Kontrollera att aktiviteten finns
    if (!activity) {
        showMessage("Aktiviteten hittades inte.", "error");
        return;
    }

    // Hitta medlemmen med hjälp av medlemsnumret
    const member = medlemsData.medlemmar.find(function(member) {
        return member.medlemsnummer === memberNumber;
    });

    // Kontrollera att medlemsnumret finns i medlemsregistret
    if (!member) {
        showMessage("Medlemsnumret finns inte.", "error");
        return;
    }

    // Kontrollera om medlemmen redan är anmäld till aktiviteten
    if (activity.deltagare.includes(memberNumber)) {
        showMessage("Medlemmen är redan anmäld.", "error");
        return;
    }

    // Kontrollera om aktiviteten har nått sitt maxantal deltagare
    if (activity.deltagare.length >= activity.max_deltagare) {
        showMessage("Aktiviteten är fullbokad.", "error");
        return;
    }

    // Lägg till medlemsnumret i aktivitetens deltagarlista
    activity.deltagare.push(memberNumber);

    // Uppdatera antalet anmälda deltagare
    activity.antal_anmälda = activity.deltagare.length;

    // Skriv ut deltagarlistan i webbläsarens konsol för testning
    console.log("Deltagare tillagd:", activity.deltagare);

    // Visa ett bekräftelsemeddelande med medlemmens namn
    showMessage(
        member.fornamn + " " + member.efternamn + " har anmälts!",
        "success"
    );

    // Uppdatera informationen på webbsidan
    displayActivityInfo(activityId);

}


// Avregistrera en medlem från en aktivitet
export function unregisterMember(activityId, memberNumber) {

    // Hitta aktiviteten
    const activity = data.aktiviteter.find(function(activity) {
        return activity.id === activityId;
    });

    if (activity === undefined) {
        showMessage("Aktiviteten hittades inte.", "error");
        return;
    }

    // Hitta medlemsnumrets plats i deltagarlistan
    const index = activity.deltagare.indexOf(memberNumber);

    if (index === -1) {
        showMessage("Medlemmen är inte anmäld.", "error");
        return;
    }

    // Ta bort medlemmen från listan
    activity.deltagare.splice(index, 1);

    // Uppdatera antalet anmälda
    updateParticipantCount(activity);

    showMessage("Medlemmen har avregistrerats.", "success");

    // Uppdatera informationen om aktiviteten
    displayActivityInfo(activityId);

}


// Hämta alla deltagare i en aktivitet
export function getParticipants(activityId) {

    // Hitta aktiviteten
    const activity = data.aktiviteter.find(function(activity) {
        return activity.id === activityId;
    });

    if (activity === undefined) {
        return [];
    }

    const participants = [];

    // Gå igenom alla medlemsnummer i deltagarlistan
    activity.deltagare.forEach(function(memberNumber) {

        // Hitta medlemmen i medlemslistan
        const member = medlemsData.medlemmar.find(function(member) {
            return member.medlemsnummer === memberNumber;
        });

        if (member !== undefined) {
            participants.push(member);
        }

    });

    return participants;

}


// Visa information om en aktivitet
export function displayActivityInfo(activityId) {

    // Hitta aktiviteten
    const activity = data.aktiviteter.find(function(activity) {
        return activity.id === activityId;
    });

    if (activity === undefined) {
        return;
    }

    const activityInfo = document.getElementById("activityInfo");
    const participantList = document.getElementById("participantList");

    // Räkna ut hur många platser som är lediga
    const availablePlaces =
        activity.max_deltagare - activity.deltagare.length;

    // Visa information om aktiviteten
    activityInfo.innerHTML = `
        <div class="activity-info">
            <strong>${activity.namn}</strong><br>
            Kategori: ${activity.kategori || "-"}<br>
            Datum: ${activity.datum}<br>
            Dag: ${activity.veckodag}<br>
            Tid: ${activity.tid}<br>
            Plats: ${activity.plats}<br>
            Antal anmälda: ${activity.deltagare.length}
            / ${activity.max_deltagare}<br>
            Lediga platser: ${availablePlaces}
        </div>
    `;

    // Hämta deltagarna
    const participants = getParticipants(activityId);

    // Töm den gamla deltagarlistan
    participantList.innerHTML = "";

    // Kontrollera om det finns några deltagare
    if (participants.length === 0) {

        participantList.textContent = "Inga anmälda deltagare.";

    } else {

        // Visa alla deltagare
        participants.forEach(function(member) {

            const participant = document.createElement("div");

            participant.className = "participant";

            participant.textContent =
                member.medlemsnummer + " - " +
                member.fornamn + " " +
                member.efternamn;

            participantList.appendChild(participant);

        });

    }

}


// Visa meddelanden på sidan
export function showMessage(message, type) {

    const messageElement = document.getElementById("message");

    messageElement.textContent = message;
    messageElement.className = type;

}


// Hämta den aktivitet som användaren har valt
export function getSelectedActivityId() {

    const value = document.getElementById("activitySelect").value;

    if (value === "") {
        return null;
    }

    return Number(value);

}
