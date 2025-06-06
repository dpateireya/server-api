import express from "express";
import { google } from "googleapis";
import cors from "cors";
const app = express();
app.use(cors());
app.use(express.json());

// Load credentials
const auth = new google.auth.GoogleAuth({
  keyFile: "./credential.json", // Path to your service account key file
  // Ensure the key file has the correct permissions and is accessible
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// Your Google Sheet ID and target range
const spreadsheetId = "124o8MZADQPhs-1MvhBnj0f_5oAtw9HLu8queIIYfje4";
const range = "Sheet1!A2:F1000"; // Example range

// GET route to fetch data from the Google Sheet
app.get("/get-data", async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range, // Adjust range as needed
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      res.status(200).json({ message: "No data found." });
    } else {
      res.status(200).json({ data: rows });
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Failed to fetch data from Google Sheet.");
  }
});

app.get("/get-data/:name", async (req, res) => {
  try {
    const targetName = req.params.name.toLowerCase();

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No data found." });
    }

    // Assuming the first column is Name
    const matchedRow = rows.find((row) => row[0]?.toLowerCase() === targetName);

    if (!matchedRow) {
      return res
        .status(404)
        .json({ message: `No entry found for ${targetName}` });
    }

    res.json({ data: matchedRow });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/get-row-index/:name", async (req, res) => {
  try {
    const targetName = req.params.name.toLowerCase();

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range, // skip header (assume A1 is header row)
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No data found." });
    }

    const matchedIndex = rows.findIndex(
      (row) => row[0]?.toLowerCase() === targetName
    );

    if (matchedIndex === -1) {
      return res
        .status(404)
        .json({ message: `Name '${targetName}' not found.` });
    }

    const googleSheetRowNumber = matchedIndex + 2; // +2 because we skipped row 1 (header) and index starts from 0

    res.json({
      name: targetName,
      rowIndex: googleSheetRowNumber,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/add-data", async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });
    const { values } = req.body; // Expecting { values: [["Name", "Email"], ["John", "john@example.com"]] }

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    res.json({ status: "successfully", response: response.data });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error writing to sheet");
  }
});

app.put("/update-data/:rowIndex", async (req, res) => {
  try {
    const rowIndex = req.params.rowIndex; // e.g., 2
    const { values } = req.body; // [[updatedName, updatedEmail]]

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const range = `Sheet1!A${rowIndex}:F${rowIndex}`; // Adjust columns as needed

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    res.json({ status: "success", updatedRange: response.data.updatedRange });
  } catch (error) {
    console.error("Error updating data:", error);
    res.status(500).send("Failed to update row.");
  }
});

app.delete("/delete-data/:rowIndex", async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.rowIndex); // Google Sheet row number (1-based)
    if (isNaN(rowIndex) || rowIndex < 2) {
      return res
        .status(400)
        .json({ message: "Row index must be >= 2 (cannot delete header)" });
    }

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const request = {
      spreadsheetId,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0, // Sheet ID (not name). Use 0 for first/default sheet
                dimension: "ROWS",
                startIndex: rowIndex - 1, // 0-based, inclusive
                endIndex: rowIndex, // exclusive
              },
            },
          },
        ],
      },
    };

    const response = await sheets.spreadsheets.batchUpdate(request);

    res.json({
      message: `Row ${rowIndex} deleted successfully.`,
      status: "success",
    });
  } catch (error) {
    console.error("Error deleting row:", error);
    res.status(500).send("Failed to delete row.");
  }
});

app.listen(5000, () => console.log("Server started on http://localhost:5000"));
// To run this server, make sure you have the necessary packages installed:
// npm install express googleapis
