from flask import Flask, render_template, jsonify
import pandas as pd

app = Flask(__name__)

# Load Excel data once
df = pd.read_excel("attendance_data.xlsx")

# Trim and uppercase Employee IDs to avoid mismatch
df['Employee ID'] = df['Employee ID'].astype(str).str.strip().str.upper()

# Convert time columns to timedelta
time_cols = ['Avg. Office hrs', 'Avg. Bay hrs', 'Avg. Break hrs', 'Avg. Cafeteria hrs', 'Avg. OOO hrs']
for col in time_cols:
    df[col] = pd.to_timedelta(df[col].astype(str))

# ---------------------------
# New Risk Calculation
# ---------------------------
def calculate_risk(row):
    """
    Calculate risk based on office hours, bay hours, and break hours.
    Returns a tuple: (risk_label, risk_score)
    """

    # Convert to hours
    bay_hours = row['Avg. Bay hrs'].total_seconds() / 3600
    office_hours = row['Avg. Office hrs'].total_seconds() / 3600
    break_hours = row['Avg. Break hrs'].total_seconds() / 3600

    if office_hours == 0:
        return "Unknown", 100  # maximum risk

    bay_ratio = bay_hours / office_hours

    # Initialize score
    score = 0

    # 1️⃣ Low office hours → higher risk
    if office_hours < 6:
        score += 50
    elif office_hours < 8:
        score += 25

    # 2️⃣ Excessive break → increase risk
    if break_hours > 1.5:
        score += 30
    elif break_hours > 1.0:
        score += 15

    # 3️⃣ Low bay ratio → increase risk
    if bay_ratio < 0.6:
        score += 40
    elif bay_ratio < 0.75:
        score += 20

    # Cap score at 100
    score = min(score, 100)

    # Assign label based on score
    if score >= 60:
        risk_label = "High"
    elif score >= 30:
        risk_label = "Medium"
    else:
        risk_label = "Low"

    return risk_label, score

# Classification & recommendation
def classify_and_recommend(row):
    bay_hours = round(row['Avg. Bay hrs'].total_seconds()/3600, 2)
    break_hours = round(row['Avg. Break hrs'].total_seconds()/3600, 2)
    office_hours = bay_hours + break_hours
    over_break_ratio = (break_hours / office_hours) if office_hours > 0 else 0

    if office_hours >= 8.45 and bay_hours >= 7:
        classification = "Punctual & Compliant"
        action = "Acknowledge & Retain: Send a positive note and consider for high-priority roles."
    elif office_hours >= 8.45 and bay_hours < 7:
        classification = "Bay-Time Deficient"
        action = "Focused Discussion: Discuss non-work distractions and monitor Over-Break ratio."
    elif office_hours < 8.45 and bay_hours >= 5:
        classification = "Office-Time Deficient"
        action = "Focused Discussion: Time management coaching and 30-day monitoring period."
    else:
        classification = "Critically Deficient"
        action = "Formal Review: Escalate to manager & HR for potential role change or transition."

    if bay_hours < 7:
        percent_below = ((7 - bay_hours)/7) * 100
        justification = f"Employee's Average Bay Hours ({bay_hours:.2f}) are {percent_below:.1f}% below the required 7 hours, and the Over-Break Ratio is {over_break_ratio*100:.1f}% (benchmark: ≤20%)."
    else:
        justification = f"Employee's Average Bay Hours ({bay_hours:.2f}) meet or exceed the required 7 hours, and the Over-Break Ratio is {over_break_ratio*100:.1f}% (benchmark: ≤20%)."

    return classification, action, justification

# ---------------------------
# Routes
# ---------------------------
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/employee/<emp_id>")
def get_employee(emp_id):
    emp_id_str = str(emp_id).strip().upper()
    result = df[df['Employee ID'] == emp_id_str]

    if result.empty:
        return jsonify({"error": "Employee not found"}), 404

    row = result.iloc[0]

    # ✅ Use new risk calculation
    risk_label, risk_score = calculate_risk(row)

    classification, recommendation, justification = classify_and_recommend(row)

    # Build response dict
    response = row.to_dict()
    response['Risk'] = risk_label
    response['RiskScore'] = risk_score  # optional numeric score
    response['Classification'] = classification
    response['RecommendedAction'] = recommendation
    response['Justification'] = justification

    if "Unbilled" in row:
      response["Billed"] = "Yes" if row["Unbilled"] else "No"
    else:
      response["Billed"] = "—"

    # Convert Timedelta to HH:MM:SS for profile table
    for k, v in response.items():
        if isinstance(v, pd.Timedelta):
            total_seconds = int(v.total_seconds())
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            seconds = total_seconds % 60
            response[k] = f"{hours:02}:{minutes:02}:{seconds:02}"
        elif pd.isna(v):
            response[k] = None

    # Prepare GraphData for Plotly
    graph_data = []
    for _, r in df.iterrows():
        office_h = r['Avg. Office hrs'].total_seconds()/3600
        bay_h = r['Avg. Bay hrs'].total_seconds()/3600
        break_h = r['Avg. Break hrs'].total_seconds()/3600
        office_total = office_h + break_h
        over_break_ratio = (break_h / office_total * 100) if office_total > 0 else 0
        graph_data.append({
            "Employee ID": str(r['Employee ID']),
            "Avg. Office hrs": round(office_h, 2),
            "Avg. Bay hrs": round(bay_h, 2),
            "Avg. Break hrs": round(break_h, 2),
            "Over-Break Ratio (%)": round(over_break_ratio, 2),
            "Half-Day leave": r.get("Half-Day leave", 0),
            "Full-Day leave": r.get("Full-Day leave", 0)
        })

    response['GraphData'] = graph_data

    return jsonify(response)

# ---------------------------
# Run App
# ---------------------------
if __name__ == "__main__":
    app.run(debug=True)
