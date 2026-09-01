export type DemoAthlete = { firstName: string; lastName: string; position: string };
export type DemoTeam = { code: string; name: string; association: string; athletes: DemoAthlete[] };

const athletes = (rows: string[][]): DemoAthlete[] =>
  rows.map(([firstName, lastName, position]) => ({ firstName, lastName, position }));

export const DEMO_TEAMS: DemoTeam[] = [
  { code: 'BRB', name: 'Barbados', association: 'Barbados Netball Association', athletes: athletes([
    ['Shakira','Waldron','GS'], ['Jada','Clarke','GA'], ['Rebecca','Harewood','WA'],
    ['Kyla','Williams','C'], ['Whitney','Squires','WD'], ['Janelle','Carter','GD'],
    ['Aliyah','Pilgrim','GK'], ['Tianna','Stoddard','GS/GA'], ['Zoe','Cadogan','WA/C'],
    ['Kayla','Thompson','WD/GD'], ['Morgan','Foster','GK/GS'],
  ])},
  { code: 'CAN', name: 'Canada', association: 'Netball Canada', athletes: athletes([
    ['Karyn','Bailey','GS'], ['Georgia','Wood','GA'], ['Tyla','Hance','WA'],
    ['Kate','Burley','C'], ['Funmi','Fadoju','WD'], ['Emily','Nicholls','GD'],
    ['Jordan','Crozier','GK'], ['Laura','Langman','GS/GA'], ['Saryn','Streeter','WA/C'],
    ['Alyssa','Manns','WD/GD'], ['Shadine','Van Der Merwe','GK/GS'],
  ])},
  { code: 'SVG', name: 'Saint Vincent and the Grenadines', association: 'Saint Vincent and the Grenadines Netball Association', athletes: athletes([
    ['Kimora','John','GS'], ['Mikayla','Charles','GA'], ['Janelle','Nolan','WA'],
    ['Shania','Samuel','C'], ['Rashida','Browne','WD'], ['Keisha','Peters','GD'],
    ['Ashley','Harris','GK'], ['Danielle','Henry','GS/GA'], ['Jada','Simmons','WA/C'],
    ['Rebekah','Prince','WD/GD'], ['Nicole','Edwards','GK/GS'],
  ])},
  { code: 'USA', name: 'United States', association: 'USA Netball', athletes: athletes([
    ['Kiera','Austin','GS'], ['Jordyn','Simmons','GA'], ['Nicole','Hayes','WA'],
    ['Samantha','Wallace','C'], ['Erica','Fowler','WD'], ['Hannah','Joseph','GD'],
    ['Imani','Anderson','GK'], ['Allison','Maloney','GS/GA'], ['Ashley','Dorsey','WA/C'],
    ['Devon','Johnson','WD/GD'], ['Taylor','Bennett','GK/GS'],
  ])},
  { code: 'GRD', name: 'Grenada', association: 'Netball Grenada', athletes: athletes([
    ['Shante','Joseph','GS'], ['Janelle','Andrews','GA'], ['Nikita','Paris','WA'],
    ['Aisha','James','C'], ['Kimberley','Pierre','WD'], ['Tiffany','Felix','GD'],
    ['Daynaisha','Charles','GK'], ['Sashana','Bain','GS/GA'], ['Mikaela','Rhoden','WA/C'],
    ['Alana','Stewart','WD/GD'], ['Kerryanne','Niles','GK/GS'],
  ])},
  { code: 'TTO', name: 'Trinidad & Tobago', association: 'Trinidad and Tobago Netball Association', athletes: athletes([
    ['Kiah','Phillip','GS'], ['Elisha','Alexander','GA'], ['Janelle','Glasgow','WA'],
    ['Shamera','Sterling','C'], ['Kalifa','Mc Collum','WD'], ['Danielle','Williams','GD'],
    ['Achel','Nurse','GK'], ['Nicole','Nicholls','GS/GA'], ['Rhiannon','Harry','WA/C'],
    ['Brittney','Cox','WD/GD'], ['Samantha','Wallace','GK/GS'],
  ])},
  { code: 'LCA', name: 'Saint Lucia', association: 'Saint Lucia National Netball Association', athletes: athletes([
    ['Kennedy','Charles','GS'], ['Nerissa','Edward','GA'], ['Jenga','James','WA'],
    ['Kadia','Charles','C'], ['Sasha','Louisy','WD'], ['Josie','Henry','GD'],
    ['Alyssa','Jules','GK'], ['Micaela','Pierre','GS/GA'], ['Kimani','Cornwall','WA/C'],
    ['Taylor','Frederick','WD/GD'], ['Chanelle','Edmund','GK/GS'],
  ])},
  { code: 'VGB', name: 'British Virgin Islands', association: 'British Virgin Islands Netball Association', athletes: athletes([
    ['T’Andra','Stephenson','GS'], ['Shanice','Vanterpool','GA'], ['Kadi-Ann','Wheatley','WA'],
    ['Christiana','Frett','C'], ['Nadean','Hill','WD'], ['Chanelle','Hodge','GD'],
    ['Mikayla','Tynes','GK'], ['Jada','Pearson','GS/GA'], ['Kylee','Ignace','WA/C'],
    ['Elisha','Richards','WD/GD'], ['Kylie','Monroe','GK/GS'],
  ])},
];

export function demoBiography(team: DemoTeam, athlete: DemoAthlete) {
  const positionLabel = athlete.position.replaceAll('/', ' and ');
  return `${athlete.firstName} ${athlete.lastName} is a demo ${positionLabel} athlete representing ${team.name} in the Americas qualifier presentation dataset. Her profile highlights the speed, discipline and team-first decision-making expected in international netball, with a role tailored to ${positionLabel} responsibilities across the court. This biography and athlete identity are fictional demonstration content created for platform testing and are not official federation records.`;
}
