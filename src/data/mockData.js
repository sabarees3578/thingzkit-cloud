// Mock data for the entire dashboard
export const DEVICES = [
    { id: 1, name: 'Living Room Sensor', type: 'Temperature & Humidity', icon: '🌡️', location: 'Living Room', status: 'online', temp: 27.4, humid: 58, battery: 82, lastSeen: 'Just now', tag: 'sensor', color: 'rgba(108,99,255,0.12)' },
    { id: 2, name: 'Kitchen Monitor', type: 'Multi-Sensor', icon: '🍳', location: 'Kitchen', status: 'online', temp: 31.2, humid: 65, battery: 65, lastSeen: '1 min ago', tag: 'sensor', color: 'rgba(255,107,53,0.12)' },
    { id: 3, name: 'Bedroom Climate', type: 'Temperature Sensor', icon: '🛏️', location: 'Bedroom', status: 'online', temp: 24.1, humid: 52, battery: 91, lastSeen: 'Just now', tag: 'sensor', color: 'rgba(0,212,255,0.1)' },
    { id: 4, name: 'Garage Node', type: 'Motion + Temp', icon: '🚗', location: 'Garage', status: 'offline', temp: null, humid: null, battery: 12, lastSeen: '3 hrs ago', tag: 'sensor', color: 'rgba(74,78,106,0.15)' },
    { id: 5, name: 'Smart AC Unit', type: 'Actuator', icon: '❄️', location: 'Living Room', status: 'online', temp: null, humid: null, power: 1800, battery: null, lastSeen: 'Just now', tag: 'actuator', color: 'rgba(0,229,160,0.1)' },
    { id: 6, name: 'Garden Irrigation', type: 'Smart Valve', icon: '🌿', location: 'Garden', status: 'online', temp: 33.0, humid: 40, battery: 78, lastSeen: '5 min ago', tag: 'actuator', color: 'rgba(0,229,160,0.08)' },
    { id: 7, name: 'Rooftop Weather', type: 'Weather Station', icon: '🛰️', location: 'Rooftop', status: 'online', temp: 36.5, humid: 39, battery: 100, lastSeen: 'Just now', tag: 'sensor', color: 'rgba(108,99,255,0.1)' },
    { id: 8, name: 'Entrance Security', type: 'Motion + Camera', icon: '🔒', location: 'Entrance', status: 'online', temp: null, humid: null, battery: 55, lastSeen: '2 min ago', tag: 'sensor', color: 'rgba(255,71,87,0.08)' },
]

export const ACTIVITY = [
    { color: 'var(--accent-green)', text: '<strong>Living Room Sensor</strong> reported 27.4°C', time: 'Just now' },
    { color: 'var(--accent-purple)', text: '<strong>Smart AC Unit</strong> turned on automatically', time: '4 min ago' },
    { color: 'var(--accent-orange)', text: '<strong>Rooftop Weather</strong> – temperature above 36°C threshold', time: '12 min ago' },
    { color: 'var(--accent-blue)', text: '<strong>Garden Irrigation</strong> started scheduled cycle', time: '22 min ago' },
    { color: 'var(--accent-red)', text: '<strong>Garage Node</strong> went offline', time: '3 hrs ago' },
    { color: 'var(--accent-green)', text: '<strong>Kitchen Monitor</strong> humidity normalised', time: '4 hrs ago' },
]

export const AUTOMATIONS = [
    { id: 1, icon: '🌙', name: 'Night Mode', desc: 'Dim all lights and lower AC at 10 PM', status: 'enabled', trigger: 'Time-based' },
    { id: 2, icon: '🌡️', name: 'Over-temp Alert', desc: 'Send notification if any room exceeds 35°C', status: 'enabled', trigger: 'Sensor-based' },
    { id: 3, icon: '💧', name: 'Auto Irrigation', desc: 'Water garden every morning at 6 AM for 15 mins', status: 'enabled', trigger: 'Time-based' },
    { id: 4, icon: '🔒', name: 'Security Lock', desc: 'Lock doors automatically when nobody is home', status: 'disabled', trigger: 'Presence-based' },
]

export const ALERTS_DATA = [
    { id: 1, level: 'critical', icon: '🌡️', title: 'Temperature Alert – Node-3', desc: 'Rooftop temperature exceeded the configured threshold of 35°C. Current reading: 36.5°C', time: '12 min ago' },
    { id: 2, level: 'warning', icon: '⚡', title: 'High Power Consumption – AC Unit', desc: 'Smart AC Unit is drawing 1800W, which is above the 1500W warning threshold.', time: '30 min ago' },
    { id: 3, level: 'info', icon: '🔋', title: 'Low Battery – Garage Node', desc: 'Garage Node battery is at 12%. Please replace or charge soon.', time: '1 hour ago' },
    { id: 4, level: 'info', icon: '📡', title: 'Device came back online', desc: 'Entrance Security Camera reconnected after brief disconnection.', time: '2 hours ago' },
]

export const TEAM_DATA = [
    { id: 1, initials: 'JD', name: 'John Doe', role: 'Admin', status: 'active', color: 'linear-gradient(135deg,var(--accent-purple),var(--accent-blue))' },
    { id: 2, initials: 'SA', name: 'Sara Ahmed', role: 'Engineer', status: 'active', color: 'linear-gradient(135deg,var(--accent-green),#00B4D8)' },
    { id: 3, initials: 'RK', name: 'Rohan Kumar', role: 'Viewer', status: 'inactive', color: 'linear-gradient(135deg,var(--accent-orange),var(--accent-red))' },
    { id: 4, initials: 'PM', name: 'Priya M.', role: 'Engineer', status: 'active', color: 'linear-gradient(135deg,var(--accent-yellow),var(--accent-orange))' },
]

export const QUICK_CONTROLS_DATA = [
    { id: 1, name: 'Smart AC', location: 'Living Room', icon: '❄️', on: true },
    { id: 2, name: 'Garden Light', location: 'Garden', icon: '💡', on: false },
    { id: 3, name: 'Irrigation', location: 'Garden', icon: '🌿', on: true },
    { id: 4, name: 'Security', location: 'Entrance', icon: '🔒', on: true },
]

export const MAP_BLIPS = [
    { id: 1, label: 'Living Room', left: '30%', top: '40%', color: 'green' },
    { id: 2, label: 'Kitchen', left: '60%', top: '25%', color: 'green' },
    { id: 3, label: 'Bedroom', left: '75%', top: '60%', color: 'blue' },
    { id: 4, label: 'Garage', left: '20%', top: '70%', color: 'orange' },
    { id: 5, label: 'Garden', left: '50%', top: '65%', color: 'green' },
    { id: 6, label: 'Office', left: '85%', top: '40%', color: 'green' },
    { id: 7, label: 'Rooftop', left: '42%', top: '18%', color: 'purple' },
    { id: 8, label: 'Entrance', left: '10%', top: '25%', color: 'green' },
]
