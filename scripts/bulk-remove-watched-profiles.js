// Script to bulk remove watched profiles by name
// Run with: SUPABASE_URL=xxx SUPABASE_KEY=xxx node scripts/bulk-remove-watched-profiles.js

const { createClient } = require('@supabase/supabase-js');

// Read from env vars - can be passed inline or from .env.local
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_KEY environment variables.');
  console.error('Usage: SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=xxx node scripts/bulk-remove-watched-profiles.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const namesToRemove = [
  "Charles E. Gaudet II",
  "Harshida Acharya",
  "David Osterweil",
  "Penny Primus",
  "Joe Indig",
  "Heather Cheney",
  "Darpan Seth",
  "Pradeep Hegde",
  "Will Stokes",
  "Preston Rutherford",
  "Harish Abbott",
  "Kyle Hency",
  "Dave Wardell",
  "Daniel Anderson",
  "Luis Madrid",
  "Kiran Ramzi Mukunda",
  "Lucille DeHart",
  "Ray Bradbury",
  "Will Smith",
  "James Davis",
  "Jana Krekic",
  "Shanann Heaton",
  "Robert Brunner",
  "Heidi Robinson",
  "MichaelAaron Flicker",
  "Richard Shotton",
  "Tim den Heijer",
  "Yoni Kozminski",
  "Michael Barron",
  "Peter Theran",
  "Mark Schumacher",
  "Ahmad Nazir",
  "Ahmad Khan",
  "Lindsey Rosenberg",
  "Divia Singh",
  "Christa Locallo",
  "Paul Jurgensen",
  "Arianne Foulks",
  "Lyne Castonguay",
  "Eric Grunewald",
  "Andrew Faris",
  "Curtis Matsko",
  "Daniel Kasidi",
  "Kiran Patil",
  "Kieran McNeill",
  "Therese Waechter",
  "Heath Golden",
  "Randy Shoemaker",
  "Seamus Menihane",
  "Jason Richelson",
  "Prashant Shah",
  "Michael C. Martocci",
  "Myrna Aponte",
  "Nipun Seri",
  "Artem Mashkov",
  "Helen Rankin",
  "Jorge Velez",
  "Mariam Garner",
  "Jess R.",
  "Uniqua Couch",
  "Francisco Escobar",
  "Bryan Ramirez",
  "Caitlin Levine",
  "Margaret Johnson",
  "Narin Phol",
  "Nipun Bansal",
  "Puneet Vaid",
  "Alejandra Ospina Rodriguez",
  "Pedro Diaz",
  "Zoe Aumick",
  "Javier Castaneda",
  "Sanjoli Mangat",
  "Karthik Vasudevan",
  "Tiago Paiva",
  "Keven Narrainen",
  "William Thayer",
  "Jordan Morrell",
  "Alan Quach",
  "Lockie Andrews",
  "Dov Moran",
  "Leesa Eichberger",
  "Larry Li",
  "Barry O'Neill",
  "Robin Raskin",
  "Aaron Cordovez",
  "Zach Stuck",
  "Carl Szasz",
  "Michael Moore",
  "Scott Zenker",
  "Abigail Cook Stone",
  "Sierra St. Pierre",
  "Sophia Poppe",
  "Emily Wilmoth",
  "Margaret Steingart",
  "Jeppe Lisdorf",
  "Scott Pattillo",
  "Cameron Gawley",
  "Rico J. Macaraeg",
  "Amber Vitale",
  "Katherine Prime",
  "Liz Edmiston",
  "Mike Gray",
  "Lily Newman",
  "Krista B.",
  "Kerstin Hadzik",
  "Brendan Witcher",
  "Jess Crane",
  "Jeff Streader",
  "Parnell Eagle",
  "Danielle Lafleur",
  "Mo B.",
  "Will McGinn",
  "Ruben Hassid",
  "Sumit Bansal",
  "Alex S.",
  "Seth Spears",
  "Kelly Stacey",
  "Christine Kelley Storch",
  "Michael Clinton",
  "Tim Morgan",
  "Larry Waterman",
  "Brian Dunlap",
  "Peter Kim",
  "Yossi Nasser",
  "Donny Greenberger",
  "Caroline Levy Limpert",
  "David Shamszad",
  "Stephanie Greer",
  "Harper Poe",
  "Benita Singh",
  "Liz Barrere",
  "Scipione B.",
  "Josh Krepon",
  "Colleen Waters",
  "Ben Cogan",
  "Max Starkman",
  "Hasan Lodhi",
  "James Ren",
  "Peyton Bigora",
  "Benjamin Baxter",
  "Kassi Heidenreich",
  "Bradley Ryan C.",
  "Dan Caron",
  "Joe Schaefer",
  "Christopher Heyn",
  "Patty Delgado",
  "Ponch Membreño",
  "Brenna Lyden",
  "Christina Bullock",
  "Eric Hulli",
  "Richard Ginsburg",
  "Gregory Lewis",
  "Terry Kirtley",
  "Anastasia Bottos",
  "Vickie Catina",
  "Aaron Cunningham",
  "Mesh Gelman",
  "Ann Crady Weiss",
  "David Weiss",
  "Katie Kaps",
  "Lauren Berlingeri",
  "Richard Christiansen",
  "Zachary Hill",
  "Taylor McCleneghan",
  "Alex Y.",
  "Gautham Chidambaram",
  "Mitch Brandow",
  "Jesse S.",
  "Daryl Gullickson",
  "Thomas Minieri",
  "Gretta van Riel"
];

async function bulkRemoveWatchedProfiles() {
  console.log(`\nAttempting to remove ${namesToRemove.length} profiles from watched list...\n`);

  // First, find prospect IDs by matching names
  const { data: prospects, error: findError } = await supabase
    .from('prospects')
    .select('id, full_name')
    .in('full_name', namesToRemove);

  if (findError) {
    console.error('Error finding prospects:', findError);
    process.exit(1);
  }

  if (!prospects || prospects.length === 0) {
    console.log('No matching prospects found in database.');
    return;
  }

  console.log(`Found ${prospects.length} matching prospects in database.`);

  const foundNames = prospects.map(p => p.full_name);
  const notFoundNames = namesToRemove.filter(n => !foundNames.includes(n));
  const prospectIds = prospects.map(p => p.id);

  // Check how many of these are in watched profiles
  const { data: watchedProfiles, error: watchedError } = await supabase
    .from('engagement_watched_profiles')
    .select('prospect_id')
    .in('prospect_id', prospectIds);

  if (watchedError) {
    console.error('Error checking watched profiles:', watchedError);
    process.exit(1);
  }

  console.log(`Of these, ${watchedProfiles?.length || 0} are currently in watched profiles.\n`);

  if (!watchedProfiles || watchedProfiles.length === 0) {
    console.log('No matching profiles in watched list to remove.');
    if (notFoundNames.length > 0) {
      console.log(`\n${notFoundNames.length} names not found in prospects table.`);
    }
    return;
  }

  // Delete from watched profiles
  const { error: deleteError, count } = await supabase
    .from('engagement_watched_profiles')
    .delete()
    .in('prospect_id', prospectIds);

  if (deleteError) {
    console.error('Error deleting watched profiles:', deleteError);
    process.exit(1);
  }

  console.log(`Successfully removed ${watchedProfiles.length} profiles from watched list.`);

  if (notFoundNames.length > 0) {
    console.log(`\n${notFoundNames.length} names not found in prospects table:`);
    notFoundNames.slice(0, 10).forEach(n => console.log(`  - ${n}`));
    if (notFoundNames.length > 10) {
      console.log(`  ... and ${notFoundNames.length - 10} more`);
    }
  }
}

bulkRemoveWatchedProfiles()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
