function validateCommandPayload(req, res, next) {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ detail: "Missing required 'command' field in request body." });
  }

  const allowed = ['FORWARD', 'BACKWARD', 'LEFT', 'RIGHT', 'STOP', 'EMERGENCY_STOP', 'LED_SET'];
  if (!allowed.includes(String(command).toUpperCase())) {
    return res.status(422).json({
      detail: `Invalid command '${command}'. Allowed: ${allowed.join(', ')}`,
    });
  }

  next();
}

function validateTelemetryPayload(req, res, next) {
  const { temperature_c, temperature, humidity_percent, humidity, raw_moisture_adc, rawMoistureAdc } = req.body;

  // Temperature validation
  const t = temperature_c ?? temperature;
  if (t !== undefined && t !== null && (t < -40 || t > 80)) {
    return res.status(422).json({ detail: `Temperature value ${t} is physically out of range (-40 to 80 °C).` });
  }

  // Humidity validation
  const h = humidity_percent ?? humidity;
  if (h !== undefined && h !== null && (h < 0 || h > 100)) {
    return res.status(422).json({ detail: `Humidity value ${h} must be between 0% and 100%.` });
  }

  next();
}

module.exports = {
  validateCommandPayload,
  validateTelemetryPayload,
};
