
// Här sparas informationen från JSON-filerna
let data = null;
let medlemsData = null;

// ÄNDRAT: Det senaste meddelandet som showMessage() visade (text och typ).
// activities.js läser det efter en anmälan eller avregistrering.
let lastMessage = null;

// ÄNDRAT: Koppla ihop den här filen med systemets gemensamma data.
// Medlemssidan (activities.js) skickar in listorna som activities.js och
// members.js har läst in. Då ser admin, tränare och medlemmar samma
// anmälningar, och registerMember() m.fl. fungerar på den gemensamma datan.
function connectSharedData(schedule, members) {

    data = schedule;
    medlemsData = { medlemmar: members };

}


// Ladda information från båda JSON-filerna
async function loadData() {

    try {

        // Hämta träningsschemat
        const activityResponse = await fetch(
            "data/eif_traningsschema_vinter_var_2027.json"
        );

        // Kontrollera att träningsschemat kunde laddas
        if (!activityResponse.ok) {
            throw new Error("Kunde inte läsa träningsschemat.");
        }

        // Läs in träningsschemat
        data = await activityResponse.json();


        // Hämta medlemsregistret
        const memberResponse = await fetch(
            "data/eif_medlemsregister_2027.json"
        );

        // Kontrollera att medlemsregistret kunde laddas
        if (!memberResponse.ok) {
            throw new Error("Kunde inte läsa medlemsregistret.");
        }

        // Läs in medlemsregistret
        medlemsData = await memberResponse.json();


        // Kontrollera att aktiviteterna har en deltagarlista
        data.aktiviteter.forEach(function(activity) {

            // Skapa en tom array om deltagarlistan saknas
            if (!Array.isArray(activity.deltagare)) {
                activity.deltagare = [];
            }

            // Uppdatera antalet anmälda deltagare
            activity.antal_anmälda = activity.deltagare.length;

        });


        // Visa aktiviteterna i rullgardinsmenyn
        displayActivities();

        // Bekräfta att båda JSON-filerna har laddats
        console.log("Träningsschemat har laddats.");
        console.log("Antal medlemmar:", medlemsData.medlemmar.length);

    } catch (error) {

        // Skriv ut eventuella fel i konsolen
        console.error(error);

        // Visa felmeddelande på webbsidan
        showMessage("Kunde inte ladda informationen.", "error");

    }

}



// Visa alla aktiviteter i rullgardinsmenyn
function displayActivities() {

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
function addParticipant(activityId, memberNumber) {

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
function registerMember(activityId, memberNumber) {

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
    // Antalet beräknas utifrån hur många medlemsnummer som finns i arrayen
    activity.antal_anmälda = activity.deltagare.length;

    // Skriv ut deltagarlistan i webbläsarens konsol för testning
    console.log("Deltagare tillagd:", activity.deltagare);

    // Visa ett bekräftelsemeddelande med medlemmens namn
    showMessage(
        member.fornamn + " " + member.efternamn + " har anmälts!",
        "success"
    );

    // Uppdatera informationen på webbsidan
    // Den nya deltagaren visas nu i aktivitetens deltagarlista
    displayActivityInfo(activityId);

}



// Avregistrera en medlem från en aktivitet
function unregisterMember(activityId, memberNumber) {

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
function getParticipants(activityId) {

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
function displayActivityInfo(activityId) {

    // ÄNDRAT: Saknas rutorna på sidan (t.ex. på startsidan) görs ingenting
    if (document.getElementById("activityInfo") === null) {
        return;
    }

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
function showMessage(message, type) {

    // ÄNDRAT: Spara meddelandet så att andra filer kan läsa det
    lastMessage = { text: message, type: type };

    const messageElement = document.getElementById("message");

    // ÄNDRAT: Finns ingen ruta för meddelanden på sidan är vi klara
    if (messageElement === null) {
        return;
    }

    const messageElement = document.getElementById("message");

    messageElement.textContent = message;
    messageElement.className = type;

}


// Hämta den aktivitet som användaren har valt
function getSelectedActivityId() {

    const value = document.getElementById("activitySelect").value;

    if (value === "") {
        return null;
    }

    return Number(value);

}


// ÄNDRAT: Resten av filen (knapparna och inläsningen) körs bara på en sida som
// har anmälningsformuläret. På startsidan finns det inte, och då gav raderna
// nedan ett fel eftersom knapparna saknas.
if (document.getElementById("registerButton") !== null) {


// När användaren klickar på anmälningsknappen
document.getElementById("registerButton").addEventListener("click", function() {

    const activityId = getSelectedActivityId();

    const memberNumber =
        document.getElementById("memberNumber").value.trim().toUpperCase();

    // Kontrollera att båda fälten är ifyllda
    if (activityId === null || memberNumber === "") {

        showMessage("Välj aktivitet och ange medlemsnummer.", "error");
        return;

    }

    registerMember(activityId, memberNumber);

});


// När användaren klickar på avregistreringsknappen
document.getElementById("unregisterButton").addEventListener("click", function() {

    const activityId = getSelectedActivityId();

    const memberNumber =
        document.getElementById("memberNumber").value.trim().toUpperCase();

    // Kontrollera att båda fälten är ifyllda
    if (activityId === null || memberNumber === "") {

        showMessage("Välj aktivitet och ange medlemsnummer.", "error");
        return;

    }

    unregisterMember(activityId, memberNumber);

});


// När användaren väljer en aktivitet i listan
document.getElementById("activitySelect").addEventListener("change", function() {

    const activityId = getSelectedActivityId();

    if (activityId !== null) {

        displayActivityInfo(activityId);

        showMessage("", "");

    }

});
/*
function testData() {
    console.log(data.aktiviteter[0]);
    console.log(data.medlemmar);
}
*/

// Starta programmet och ladda JSON-filen
loadData();


}  // ÄNDRAT: slut på if-satsen ovan
loadData();			
