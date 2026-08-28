const experiences = ["Customer Portal", "Admin Control Center", "Drone Simulation"];
export default function Home() { return <main><h1>SkyNav</h1><p>Simulation-first UAV delivery operations foundation.</p><ul>{experiences.map((item) => <li key={item}>{item}</li>)}</ul></main>; }
