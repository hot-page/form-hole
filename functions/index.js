const {onRequest} = require("firebase-functions/v2/https")
const admin = require("firebase-admin")
const logger = require("firebase-functions/logger")

try {
  admin.initializeApp()
} catch (e) {
  logger.error("Firebase admin initialization error", e)
}

const db = admin.firestore()

exports.app = onRequest({cors: true}, async (req, res) => {
  if (req.method === "POST") {
    try {
      const contentType = req.get("content-type") || req.headers["content-type"]
      if (!contentType || !contentType.includes("application/x-www-form-urlencoded")) {
        logger.warn("Invalid Content-Type:", contentType)
        res.status(400).send("Invalid request format. Expected URL-encoded data.")
        return
      }

      const {name, message} = req.body
      const receivedFields = Object.keys(req.body)

      if (!name || typeof name !== "string" || name.trim() === "") {
        logger.warn("Validation failed: Name is missing or empty.")
        res.status(400).send("Validation Error: 'name' field is required and cannot be empty.")
        return
      }
      if (!message || typeof message !== "string" || message.trim() === "") {
        logger.warn("Validation failed: Message is missing or empty.")
        res.status(400).send("Validation Error: 'message' field is required and cannot be empty.")
        return
      }
      if (name.length > 100) {
        logger.warn("Validation failed: Name exceeds maximum length.")
        res.status(400).send("Validation Error: 'name' field must be 100 characters or less.")
        return
      }
      if (message.length > 2000) {
        logger.warn("Validation failed: Message exceeds maximum length.")
        res.status(400).send("Validation Error: 'message' field must be 2000 characters or less.")
        return
      }

      const allowedFields = ["name", "message"]
      if (!Array.isArray(receivedFields) || receivedFields.length !== allowedFields.length || !receivedFields.every((field) => allowedFields.includes(field))) {
        logger.warn("Validation failed: Unexpected fields received.", receivedFields)
        res.status(400).send("Validation Error: Only 'name' and 'message' fields are allowed.")
        return
      }

      const submission = {
        name: name.trim(),
        message: message.trim(),
        timestamp: new Date(),
      }

      await db.collection("submissions").add(submission)
      logger.log("Submission saved successfully:", submission.name)

      res.status(200).send("Thanks for your message! It will be recorded for all eternity.")
    } catch (error) {
      logger.error("Error processing POST request:", error)
      res.status(500).send("Server Error: Could not process your submission.")
    }
  } else if (req.method === "GET") {
    try {
      const snapshot = await db.collection("submissions")
          .orderBy("timestamp", "desc")
          .limit(500)
          .get()

      const submissions = []
      snapshot.forEach((doc) => {
        submissions.push(doc.data())
      })

      logger.log(`Retrieved ${submissions.length} submissions.`)

      let submissionsHtml = "<p>No submissions yet.</p>"
      if (snapshot.docs.length > 0) {
        submissionsHtml = snapshot
          .docs
          .map((doc) => doc.data())
          .map((sub) => `
            <div class="submission">
              <p class="name">${escapeHtml(sub.name)}</p>
              <time data-timestamp="${escapeHtml(sub.timestamp.toDate().toISOString())}">
                ${escapeHtml(sub.timestamp.toDate().toLocaleString("en-US"))}
              </time>
              <p class="message">${escapeHtml(sub.message)}</p>
            </div>`)
          .join("")
      }

      const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HotFX Form Hole</title>
    <style>
      body {
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        line-height: 1.6;
        padding: 20px;
        background-color: #f4f4f4;
        color: #333;
      }

      h1 {
        color: black;
        padding-bottom: 10px;
      }

      h1 img {
        margin-right: 8px;
        position: relative;
        top: 20px;
      }

      .submission {
        background-color: #fff;
        padding: 15px;
        margin-bottom: 15px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        max-width: 800px;
      }

      .name {
        font-weight: bold;
        margin-bottom: 5px;
      }

      .message {
        margin-bottom: 10px;
        white-space: pre-wrap;
      }

      .timestamp {
        color: #666;
        font-size: 0.8em;
      }

      code {
        font-family: Courier New, Courier, monospace;
        font-size: 1.1em;
      }
      
      a {
        color: DodgerBlue;
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      a:visited {
        color: SlateBlue;
      }
    </style>
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('time[data-timestamp]').forEach(function(el) {
          const date = new Date(el.getAttribute('data-timestamp'))
          if (!isNaN(date)) el.textContent = date.toLocaleString()
        })
      })
    </script>
  </head>
  <body>
    <h1>
      <img width="200" src="https://static.hot.page/hotfx-logo.svg">
      Form Hole
    </h1>
    <p>
      This is a demo for the <code>&lt;hotfx-form&gt;</code> custom element.
      <a href="https://fx.hot.page/form">Read more</a> or
      <a href="https://github.com/hot-page/form-hole">view the source.</a>
    </p>
    ${submissionsHtml}
  </body>
</html>`
      res.status(200).send(html)
    } catch (error) {
      logger.error("Error processing GET request:", error)
      res.status(500).send("Server Error: Could not retrieve submissions.")
    }
  } else {
    logger.warn("Unsupported method:", req.method)
    res.status(405).send("Method Not Allowed. Only GET and POST are supported.")
  }
})

function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return unsafe
  return unsafe
      .replace(/&/g, "&amp")
      .replace(/</g, "&lt")
      .replace(/>/g, "&gt")
      .replace(/"/g, "&quot")
      .replace(/'/g, "&#039")
}
