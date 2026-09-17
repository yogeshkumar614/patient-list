const fileInput = document.getElementById("patientFile");
const dropZone = document.getElementById("dropZone");

const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");

const previewSection = document.getElementById("previewSection");
const previewBody = document.getElementById("previewBody");
const recordCount = document.getElementById("recordCount");

const removeFile = document.getElementById("removeFile");
const cancelImport = document.getElementById("cancelImport");
const importButton = document.getElementById("importButton");

let patients = [];


// --------------------------------
// File selection
// --------------------------------

fileInput.addEventListener("change", function () {

    if (this.files.length > 0) {
        processFile(this.files[0]);
    }

});


// --------------------------------
// Drag & Drop
// --------------------------------

dropZone.addEventListener("dragover", function (event) {

    event.preventDefault();

    dropZone.classList.add("dragging");

});


dropZone.addEventListener("dragleave", function () {

    dropZone.classList.remove("dragging");

});


dropZone.addEventListener("drop", function (event) {

    event.preventDefault();

    dropZone.classList.remove("dragging");

    const file = event.dataTransfer.files[0];

    if (file) {
        processFile(file);
    }

});


// --------------------------------
// Process CSV
// --------------------------------

function processFile(file) {

    if (!file.name.toLowerCase().endsWith(".csv")) {

        alert("Please select a CSV file.");

        return;
    }


    if (file.size > 10 * 1024 * 1024) {

        alert("File is larger than 10 MB.");

        return;
    }


    fileName.textContent = file.name;

    fileSize.textContent =
        formatFileSize(file.size);


    fileInfo.style.display = "flex";


    const reader = new FileReader();


    reader.onload = function (event) {

        try {

            patients = parseCSV(event.target.result);

            showPreview();

        }

        catch (error) {

            alert(
                "Unable to read this CSV file. " +
                "Please check the format."
            );

        }

    };


    reader.readAsText(file);

}


// --------------------------------
// CSV parser
// --------------------------------

function parseCSV(text) {

    const rows = [];

    let row = [];

    let value = "";

    let insideQuotes = false;


    for (let i = 0; i < text.length; i++) {

        const char = text[i];

        const next = text[i + 1];


        if (char === '"' && insideQuotes && next === '"') {

            value += '"';

            i++;

        }

        else if (char === '"') {

            insideQuotes = !insideQuotes;

        }

        else if (char === "," && !insideQuotes) {

            row.push(value.trim());

            value = "";

        }

        else if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {

            if (char === "\r" && next === "\n") {
                i++;
            }

            row.push(value.trim());

            if (row.some(cell => cell !== "")) {
                rows.push(row);
            }

            row = [];

            value = "";

        }

        else {

            value += char;

        }

    }


    if (value || row.length) {

        row.push(value.trim());

        rows.push(row);

    }


    if (rows.length < 2) {

        throw new Error("CSV has no patient records.");

    }


    const headers = rows[0].map(
        header => header.trim().toLowerCase()
    );


    return rows.slice(1).map(values => {

        const patient = {};

        headers.forEach((header, index) => {

            patient[header] =
                values[index] || "";

        });

        return patient;

    });

}


// --------------------------------
// Preview
// --------------------------------

function showPreview() {

    previewBody.innerHTML = "";


    patients.forEach((patient, index) => {

        const row = document.createElement("tr");


        const name =
            `${patient.first_name || ""} ${patient.last_name || ""}`
            .trim();


        const valid =
            patient.first_name &&
            patient.date_of_birth &&
            patient.phone;


        row.innerHTML = `

            <td>

                <div class="patient-cell">

                    <span class="avatar tone-${index % 3}">

                        ${(patient.first_name || "?")
                            .charAt(0)
                            .toUpperCase()}

                        ${(patient.last_name || "")
                            .charAt(0)
                            .toUpperCase()}

                    </span>

                    <span>

                        <strong>
                            ${escapeHTML(name || "Unnamed patient")}
                        </strong>

                        <small>
                            ${escapeHTML(patient.email || "No email")}
                        </small>

                    </span>

                </div>

            </td>


            <td>
                ${escapeHTML(patient.date_of_birth || "—")}
            </td>


            <td>
                ${escapeHTML(patient.gender || "—")}
            </td>


            <td>
                ${escapeHTML(patient.phone || "—")}
            </td>


            <td>

                <span class="badge blood">

                    ${escapeHTML(
                        patient.blood_group || "—"
                    )}

                </span>

            </td>


            <td>

                ${
                    valid
                    ?
                    '<span class="badge active">Ready</span>'
                    :
                    '<span class="badge closed">Check fields</span>'
                }

            </td>

        `;


        previewBody.appendChild(row);

    });


    recordCount.textContent =
        `${patients.length} record${patients.length === 1 ? "" : "s"}`;


    previewSection.style.display = "block";


    previewSection.scrollIntoView({
        behavior: "smooth"
    });

}


// --------------------------------
// Import
// --------------------------------

importButton.addEventListener("click", async function () {

    if (!patients.length) {

        alert("No patients to import.");

        return;

    }


    const invalid = patients.filter(patient =>

        !patient.first_name ||
        !patient.date_of_birth ||
        !patient.phone

    );


    if (invalid.length > 0) {

        alert(
            `${invalid.length} patient record(s) `
            + `are missing required information.`
        );

        return;

    }


    importButton.disabled = true;

    importButton.textContent =
        "Importing...";


    try {

        const response = await fetch(
            "/patients/import",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "X-CSRFToken":
                        getCSRFToken()
                },

                body: JSON.stringify({
                    patients: patients
                })
            }
        );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Import failed."
            );

        }


        alert(
            `Successfully imported `
            + `${result.imported} patient(s).`
        );


        window.location.href =
            "/patients";

    }

    catch (error) {

        alert(error.message);

        importButton.disabled = false;

        importButton.textContent =
            "Import patients →";

    }

});


// --------------------------------
// Remove file
// --------------------------------

removeFile.addEventListener("click", resetImport);

cancelImport.addEventListener("click", resetImport);


function resetImport() {

    patients = [];

    fileInput.value = "";

    fileInfo.style.display = "none";

    previewSection.style.display = "none";

    previewBody.innerHTML = "";

}


// --------------------------------
// Helpers
// --------------------------------

function formatFileSize(bytes) {

    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(1) + " MB";

}


function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function getCSRFToken() {

    const token =
        document.querySelector(
            'input[name="csrf_token"]'
        );

    return token ? token.value : "";

}
