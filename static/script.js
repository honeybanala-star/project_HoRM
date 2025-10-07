async function handleSearch() {
    const empId = document.getElementById('searchInput').value.trim();
    if (!empId) return alert("Enter Employee ID!");

    try {
        const res = await fetch(`/employee/${empId}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();

        renderProfile(data);
        renderWorkingHours(data);
        renderRisk(data.Risk);
        renderRecommendation(data.RecommendedAction, data.Classification, data.Justification);

        if (data.GraphData && data.GraphData.length) {
            renderGraphs(data.GraphData, empId);
        }
    } catch (err) {
        alert("Employee not found.");
    }
}

function renderProfile(data) {
    document.getElementById("empId").textContent = data["Employee ID"];
    document.getElementById("designation").textContent = data["Designation"] || "—";
    document.getElementById("account").textContent = data["Account code"] || "—";
    document.getElementById("billed").textContent = data["Billed"] || "—";
}

function renderWorkingHours(data) {
    document.getElementById("avgIn").textContent = data["Avg. In Time"];
    document.getElementById("avgOut").textContent = data["Avg. Out Time"];
    document.getElementById("avgBay").textContent = data["Avg. Bay hrs"];
    document.getElementById("avgBreak").textContent = data["Avg. Break hrs"];
}

function renderRisk(risk) {
    const riskList = document.getElementById("riskList");
    riskList.innerHTML = "";

    // risk object should now be { label: "High", score: 72, reasons: ["Low bay ratio", "Excessive break"] }
    const badge = document.createElement("span");
    badge.classList.add("badge", risk.label.toLowerCase());
    badge.textContent = risk.label;

    // Tooltip with reasons
    if (risk.reasons && risk.reasons.length > 0) {
        badge.title = "Reasons:\n" + risk.reasons.join("\n");
    }

    riskList.appendChild(badge);
    document.getElementById("riskScore").textContent = risk.score;
}


function renderRecommendation(action, classification, justification) {
    const classColor =
        classification.includes("Punctual") ? "green" :
        classification.includes("Bay") ? "orange" :
        classification.includes("Office") ? "orange" :
        classification.includes("Critical") ? "red" : "gray";

    document.getElementById("recommendationSection").innerHTML = `
        <div style="font-size:18px; font-weight:700; margin-bottom:8px; color:${classColor}">
            ${action}
        </div>
        <div style="margin-bottom:8px; font-weight:600;">
            Classification: <span style="color:${classColor};">${classification}</span>
        </div>
        <div style="font-size:14px; color:#374151;">
            Data Justification: ${justification}
        </div>
    `;
}

function renderGraphs(graphData, selectedEmployeeId) {
    console.log("GraphData:", graphData);
    const officeHours = graphData.map(d => d["Avg. Office hrs"]);
    const bayHours = graphData.map(d => d["Avg. Bay hrs"]);
    const empIds = graphData.map(d => d["Employee ID"]);

    // === Compliance Quadrant ===
    const traceAll = {
        x: officeHours,
        y: bayHours,
        text: empIds,
        mode: "markers",
        type: "scatter",
        marker: { size: 10, color: "rgba(0,123,255,0.6)" },
        name: "All Employees"
    };

    const selectedEmp = graphData.find(d => d["Employee ID"] === String(selectedEmployeeId));
    const traceSelected = selectedEmp ? {
        x: [selectedEmp["Avg. Office hrs"]],
        y: [selectedEmp["Avg. Bay hrs"]],
        text: [`Employee ${selectedEmployeeId}`],
        mode: "markers+text",
        textposition: "top center",
        marker: { size: 14, color: "red", symbol: "star" },
        name: "Selected Employee"
    } : null;

    const maxX = Math.max(...officeHours) + 1;
    const maxY = Math.max(...bayHours) + 1;

    const layoutQuadrant = {
        xaxis: { title: "Avg. Office Hours", zeroline: false },
        yaxis: { title: "Avg. Bay Hours", zeroline: false, tickvals: [0, 5, 10] },
        shapes: [
            { type: "line", x0: 8.45, x1: 8.45, y0: 0, y1: maxY, line: { dash: "dot", color: "gray" } },
            { type: "line", x0: 0, x1: maxX, y0: 7, y1: 7, line: { dash: "dot", color: "gray" } }
        ],
        annotations: [
            { x: maxX, y: maxY, text: "Office ↑ / Bay ↑", showarrow: false, font: { size: 12, color: "green" }, xanchor: "right", yanchor: "bottom" },
            { x: 0, y: maxY, text: "Office ↓ / Bay ↑", showarrow: false, font: { size: 12, color: "orange" }, xanchor: "left", yanchor: "bottom" },
            { x: maxX, y: 0, text: "Office ↑ / Bay ↓", showarrow: false, font: { size: 12, color: "orange" }, xanchor: "right", yanchor: "top" },
            { x: 0, y: 0, text: "Office ↓ / Bay ↓", showarrow: false, font: { size: 12, color: "red" }, xanchor: "left", yanchor: "top" }
        ],
        legend: {
            orientation: "h",
            x: 0.5,
            xanchor: "center",
            y: 1.15,
            yanchor: "bottom"
        },
        margin: { t: 50, l: 50, r: 50, b: 50 },
        hovermode: "closest"
    };

    Plotly.newPlot("compliance-quadrant", traceSelected ? [traceAll, traceSelected] : [traceAll], layoutQuadrant);

    // === Leave Analysis (Selected vs Org Avg) ===
    if (selectedEmp) {
        const empLeaves = {
            "Half-Day": selectedEmp["Half-Day leave"] || 0,
            "Full-Day": selectedEmp["Full-Day leave"] || 0
        };

        const orgAvg = {
            "Half-Day": Math.round(graphData.reduce((sum, d) => sum + (d["Half-Day leave"] || 0), 0) / graphData.length),
            "Full-Day": Math.round(graphData.reduce((sum, d) => sum + (d["Full-Day leave"] || 0), 0) / graphData.length)
        };


const selectedAccount = (selectedEmp["Account code"] || "").trim().toLowerCase();

const accountEmployees = graphData.filter(d => {
    const code = (d["Account code"] || "").trim().toLowerCase();
    return code === selectedAccount;
});

console.log("Account Employees:", accountEmployees.map(e => e["Employee ID"]));

const accountAvg = accountEmployees.length > 0 ? {
    "Half-Day": Math.round(
        accountEmployees.reduce((sum, d) => sum + (d["Half-Day leave"] || 0), 0) / accountEmployees.length
    ),
    "Full-Day": Math.round(
        accountEmployees.reduce((sum, d) => sum + (d["Full-Day leave"] || 0), 0) / accountEmployees.length
    )
} : {
    "Half-Day": 0,
    "Full-Day": 0
};



        const traceEmp = {
            x: Object.keys(empLeaves),
            y: Object.values(empLeaves),
            name: `Employee ID :${selectedEmployeeId}`,
            type: "bar",
            marker: { color: "red" } // 🔴 Highlight employee
        };

const traceAccount = {
    x: Object.keys(accountAvg),
    y: Object.values(accountAvg),
    name: `Account : ${selectedEmp["Account code"]}`,
    type: "bar",
    marker: { color: "steelblue" }
};

const orgAvgLabel = `Organization Avg : ${orgAvg["Half-Day"]} HD / ${orgAvg["Full-Day"]} FD`;
const traceOrg = {
    x: Object.keys(orgAvg),
    y: Object.values(orgAvg),
    name: orgAvgLabel, // ✅ Updated label
    type: "bar",
    marker: { color: "orange" }
};
        const layoutLeave = {
            
            barmode: "group",
            xaxis: { title: "Leave Type" },
            yaxis: { title: "Number of Leaves" },
            legend: {
                orientation: "h",
                x: 0.5,
                xanchor: "center",
                y: 1.15,
                yanchor: "bottom"
            },
            margin: { t: 50, l: 50, r: 50, b: 50 }
        };

    Plotly.newPlot("leave-analysis", [traceEmp, traceAccount, traceOrg], layoutLeave);
    }
}



// Get elements
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

// Trigger search on Enter key
searchInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        event.preventDefault(); // Prevent form submission / page reload
        handleSearch();
    }
});

// Trigger search on button click
searchBtn.addEventListener("click", handleSearch);



