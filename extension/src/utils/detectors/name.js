import { claimSpan, isOverlapping, makeRisk } from './shared.js';

// ─── Positive Gazetteer ──────────────────────────────────────────────────────
//
// COMMON_FIRST_NAMES: given names across every major UK community.
//
// Purpose: a capitalised sequence whose FIRST word is in this set is treated
// as a strong positive signal — it allows 2-word sequences through without a
// surrounding context keyword, and boosts confidence for all sequences.
//
// Sources: UK ONS baby name data (England & Wales), UK Census 2021 ethnic
// breakdowns, US SSA Social Security name frequency data.
//
// Chrome content-script memory note: this set is ~10 KB — well within the
// in-memory budget for a content script (limit ~200 KB for inline data).
//
// IMPORTANT: this set is evaluated BEFORE the NON_NAME_STARTERS negative gate
// so that real names that share spelling with common adjectives are never
// blocked (e.g. "Max Johnson", "Rich Evans").

export const COMMON_FIRST_NAMES = new Set([

  // ── British / Anglo-Saxon ────────────────────────────────────────────────
  // Male
  'james', 'john', 'robert', 'michael', 'william', 'david', 'richard',
  'joseph', 'thomas', 'charles', 'christopher', 'daniel', 'matthew',
  'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua',
  'kenneth', 'kevin', 'brian', 'george', 'timothy', 'ronald', 'edward',
  'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric',
  'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon',
  'benjamin', 'samuel', 'raymond', 'gregory', 'frank', 'alexander',
  'patrick', 'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'adam',
  'henry', 'nathan', 'zachary', 'douglas', 'peter', 'kyle', 'noah',
  'ethan', 'jeremy', 'liam', 'oliver', 'harry', 'charlie', 'oscar',
  'arthur', 'freddie', 'alfie', 'theo', 'archie', 'leo', 'sebastian',
  'luke', 'dylan', 'gabriel', 'logan', 'mason', 'aiden', 'lucas',
  'elijah', 'evan', 'owen', 'cameron', 'julian', 'sean', 'ian',
  'colin', 'derek', 'trevor', 'nigel', 'graham', 'barry', 'keith',
  'craig', 'wayne', 'dean', 'alan', 'neil', 'simon', 'martin',
  'philip', 'roger', 'gerald', 'harold', 'felix', 'hugo', 'reuben',
  'elliot', 'jude', 'alfred', 'reginald', 'clive', 'stuart', 'rupert',
  // "Max" and "Rich" are real given names — kept here so that the
  // NON_NAME_STARTERS gate (which has conceptual overlap) never blocks them.
  'max', 'rich',
  // Irish / Scottish / Welsh
  'padraig', 'seamus', 'fergus', 'callum', 'angus', 'rory', 'eoin',
  'cormac', 'declan', 'brendan', 'kieran', 'cian', 'oisin', 'tadhg',
  'hamish', 'alasdair', 'iain', 'ewan', 'donal', 'rhys', 'owain',
  'gethin', 'emrys',
  // Female
  'mary', 'patricia', 'jennifer', 'linda', 'barbara', 'elizabeth',
  'susan', 'jessica', 'sarah', 'karen', 'lisa', 'nancy', 'betty',
  'margaret', 'sandra', 'ashley', 'dorothy', 'kimberly', 'emily',
  'donna', 'michelle', 'carol', 'amanda', 'melissa', 'deborah',
  'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia', 'kathleen',
  'amy', 'angela', 'shirley', 'anna', 'brenda', 'pamela', 'emma',
  'nicole', 'helen', 'samantha', 'katherine', 'christine', 'debra',
  'rachel', 'carolyn', 'janet', 'catherine', 'maria', 'heather',
  'diane', 'ruth', 'julie', 'olivia', 'isabella', 'sophia', 'ava',
  'mia', 'ella', 'grace', 'lily', 'poppy', 'amelia', 'evie', 'isla',
  'freya', 'florence', 'alice', 'matilda', 'rosie', 'esme', 'eva',
  'daisy', 'zoe', 'phoebe', 'imogen', 'claire', 'louise', 'victoria',
  'natalie', 'gemma', 'joanne', 'tracy', 'cheryl', 'alison', 'wendy',
  'dawn', 'elaine', 'pauline', 'janice', 'scarlett', 'violet',
  'madison', 'aria', 'chloe', 'abigail', 'hannah', 'addison', 'aubrey',
  'eleanor', 'lillian', 'stella', 'penelope', 'nora', 'hazel',
  'skylar', 'lucy', 'willow', 'luna', 'harper', 'iris', 'ivy',
  'rose', 'ruby', 'amber', 'jade', 'holly', 'molly', 'bella',
  'lexi', 'sophie', 'ellie', 'millie', 'megan', 'beth', 'katie',
  'fiona', 'moira', 'catriona', 'siobhan', 'niamh', 'aoife', 'bridget',
  'sinead', 'erin', 'saoirse', 'grainne', 'orla', 'ciara', 'clodagh',
  'rhiannon', 'cerys', 'angharad', 'megan', 'seren',
  // ── Dual-use names kept in gazetteer (for NHS / HR recall) ───────────────
  // These are also common English words, but specific false-positive phrases
  // (e.g. "Grace Period", "Amber Alert") are added to FALSE_POSITIVES below
  // so that the individual name still matches when paired with a real surname.
  //
  // EXCLUDED from gazetteer — collision too broad to enumerate:
  //   'may'     → month; countless phrases (May Meeting, May Update, Theresa May)
  //   'june'    → month; June Report, June Quarter …
  //   'april'   → month; April Fools, April Summary …
  //   'alpha'   → tech; Alpha Version, Alpha Test, Alpha Channel, Alpha Male
  //   'crystal' → phrase; Crystal Clear, Crystal Ball, Crystal Palace
  //   'pearl'   → phrase; Pearl Harbor, Pearl White, Pearl of Wisdom
  // These are still detected when a context keyword is present:
  //   "Name: May Jones" → context keyword "Name:" triggers detection ✓

  // ── Muslim / Pakistani / Bangladeshi / Arab ─────────────────────────────
  // Male
  'ahmed', 'ali', 'omar', 'hassan', 'ibrahim', 'mohammed', 'muhammad',
  'amir', 'tariq', 'yusuf', 'bilal', 'hamza', 'imran', 'kamran',
  'adnan', 'sajid', 'waseem', 'nadeem', 'saleem', 'rashid', 'shahid',
  'zafar', 'iqbal', 'khalid', 'usman', 'faisal', 'asif', 'naveed',
  'zahid', 'javed', 'tanvir', 'aamir', 'babar', 'waqas', 'rizwan',
  'zeeshan', 'shoaib', 'mudassar', 'raheel', 'talha', 'jawad',
  'ahsan', 'danish', 'farhan', 'irfan', 'yasir', 'zubair', 'sabir',
  'tariq', 'saeed', 'naeem', 'kareem', 'ameen', 'dawood', 'haroon',
  // Female
  'fatima', 'aisha', 'zara', 'yasmin', 'nadia', 'leila', 'amira',
  'bushra', 'hina', 'maryam', 'sadia', 'saima', 'samina',
  'shabana', 'shazia', 'tahira', 'uzma', 'zainab', 'noor', 'sana',
  'farah', 'rabia', 'humera', 'asma', 'rukhsana', 'shaista', 'ayesha',
  'iram', 'lubna', 'maheen', 'nabeela', 'parveen', 'tasleem',
  'aliya', 'amna', 'fiza', 'gulshan', 'nargis', 'rehana', 'sumaira',

  // ── Indian / Hindu ───────────────────────────────────────────────────────
  // Male
  'raj', 'rahul', 'rohan', 'arjun', 'vikram', 'nikhil', 'sanjay',
  'ravi', 'deepak', 'amit', 'suresh', 'prakash', 'anand', 'vijay',
  'rajesh', 'sunil', 'manoj', 'anil', 'dinesh', 'ramesh', 'mahesh',
  'rohit', 'mohit', 'sumit', 'kunal', 'vishal', 'gaurav', 'sachin',
  'nitin', 'vivek', 'manish', 'harish', 'yogesh', 'rakesh', 'ashish',
  'shyam', 'krishna', 'ganesh', 'tushar', 'pankaj', 'vinod',
  'kapil', 'arun', 'karthik', 'praveen', 'ajay', 'girish', 'naveen',
  'abhinav', 'abhishek', 'akhil', 'akash', 'aman', 'ankit', 'ankur',
  'anuj', 'anurag', 'ashwin', 'avinash', 'chirag', 'dilip', 'hemant',
  'jagdish', 'jitendra', 'kamal', 'lokesh', 'piyush', 'prasad',
  'pradeep', 'puneet', 'ritesh', 'sandeep', 'satyam', 'shailesh',
  'shekhar', 'tarun', 'vaibhav', 'vikas', 'subodh', 'devesh',
  // Gender-neutral / used for both
  'kiran',
  // Female
  'priya', 'ananya', 'divya', 'shreya', 'pooja', 'kavya', 'lakshmi',
  'meera', 'nisha', 'sunita', 'rekha', 'kavita', 'geeta', 'anita',
  'seema', 'neha', 'sneha', 'ritu', 'archana', 'vandana', 'anjali',
  'shweta', 'pallavi', 'madhuri', 'rani', 'lata', 'usha', 'asha',
  'srishti', 'aditi', 'jyoti', 'shilpa', 'preeti', 'puja', 'amita',
  'deepa', 'hema', 'indira', 'jaya', 'kamla', 'malvika', 'nalini',
  'nandita', 'payal', 'poonam', 'radha', 'sakshi', 'shalini', 'sheetal',
  'smita', 'sudha', 'swati', 'tanvi', 'urvashi', 'vanita', 'vidya',
  'vinita', 'charu', 'beena', 'revati', 'roshani', 'rupal', 'taruna',

  // ── Sikh / Punjabi ───────────────────────────────────────────────────────
  'gurpreet', 'harpreet', 'manpreet', 'gurjeet', 'harjeet', 'manjit',
  'amarjit', 'sukhvir', 'harjinder', 'ranjit', 'jasvinder', 'jaspreet',
  'balvinder', 'kulwinder', 'rajwinder', 'daljit', 'paramjit', 'satnam',
  'simran', 'jasleen', 'navleen', 'navjot', 'parminder', 'surjit',
  'avneet', 'gagandeep', 'hardeep', 'inderpreet', 'jagjit', 'lakhvir',

  // ── South Indian ─────────────────────────────────────────────────────────
  'venkatesh', 'subramaniam', 'krishnamurthy', 'srinivasan', 'narayanan',
  'murugan', 'selvam', 'karthikeyan', 'balasubramanian', 'raghunathan',
  'kavitha', 'geetha', 'saritha', 'sumitha', 'lalitha', 'bhavani',
  'padmavathi', 'kamakshi', 'meenakshi', 'revathi', 'sowmya', 'padmini',

  // ── French ───────────────────────────────────────────────────────────────
  // Male
  'jean', 'pierre', 'jacques', 'philippe', 'michel', 'claude', 'rene',
  'henri', 'louis', 'andre', 'marc', 'luc', 'nicolas', 'antoine',
  'julien', 'mathieu', 'guillaume', 'alexandre', 'hugo', 'maxime',
  'romain', 'raphael', 'clement', 'victor', 'baptiste', 'gilles',
  'alain', 'christophe', 'stephane', 'frederic', 'laurent', 'emmanuel',
  'benoit', 'xavier', 'didier', 'pascal', 'thierry', 'gaston',
  'edouard', 'armand', 'bertrand', 'cedric', 'florent', 'jerome',
  // Female
  'marie', 'anne', 'isabelle', 'sophie', 'sylvie', 'veronique',
  'nathalie', 'valerie', 'sandrine', 'laure', 'celine', 'aurelie',
  'camille', 'manon', 'margot', 'ines', 'mathilde', 'amelie',
  'lucie', 'anais', 'elodie', 'clemence', 'virginie', 'delphine',
  'beatrice', 'brigitte', 'francoise', 'martine', 'clotilde', 'odile',
  'nadine', 'monique', 'colette', 'josette', 'genevieve', 'eloise',
  'alienor', 'astrid', 'capucine', 'dorothee', 'emmanuelle', 'heloise',

  // ── Italian ──────────────────────────────────────────────────────────────
  // Male
  'marco', 'giuseppe', 'antonio', 'mario', 'giovanni', 'francesco',
  'roberto', 'matteo', 'leonardo', 'alessio', 'davide', 'andrea',
  'fabio', 'stefano', 'riccardo', 'sergio', 'carlo', 'dario',
  'federico', 'giorgio', 'lorenzo', 'massimo', 'nicola', 'pietro',
  'salvatore', 'simone', 'tommaso', 'vincenzo', 'luigi', 'enzo',
  'gino', 'umberto', 'emilio', 'claudio', 'maurizio', 'gianluca',
  'valerio', 'daniele', 'luca', 'filippo', 'alberto', 'cristiano',
  // Female
  'giulia', 'valentina', 'chiara', 'martina', 'federica', 'elisa',
  'francesca', 'giorgia', 'roberta', 'silvia', 'paola', 'claudia',
  'rosa', 'cristina', 'caterina', 'lucia', 'alessia', 'beatrice',
  'serena', 'veronica', 'daniela', 'carmela', 'giuseppina', 'concetta',
  'grazia', 'patrizia', 'valeria', 'raffaella', 'antonella', 'mariella',
  'eleonora', 'rossella', 'debora', 'miriam', 'sonia', 'stefania',

  // ── Nigerian (Yoruba + Igbo + Hausa) ────────────────────────────────────
  // Male
  'adebayo', 'adeola', 'adewale', 'biodun', 'bola', 'dapo', 'dele',
  'femi', 'gbenga', 'kayode', 'kunle', 'muyiwa', 'niyi', 'seun',
  'sola', 'tayo', 'tobi', 'tunde', 'wole', 'yemi', 'babatunde',
  'oluwaseun', 'oluwatobi', 'olumide', 'tosin', 'bamidele', 'akin',
  'emeka', 'chidi', 'chinonso', 'chinedu', 'chijioke', 'obinna',
  'kelechi', 'nnamdi', 'ifeanyi', 'uche', 'chibuike', 'chukwudi',
  'obi', 'ikenna', 'aminu', 'umar', 'musa', 'garba', 'suleiman',
  'oluwatosin', 'oluwadarasimi', 'adegoke', 'adeniyi', 'adeleke',
  // Female
  'ngozi', 'adaeze', 'chioma', 'amaka', 'nneka', 'ifeoma', 'adaobi',
  'chiamaka', 'bolanle', 'folake', 'funmi', 'kehinde', 'lola', 'ronke',
  'taiwo', 'titi', 'yetunde', 'abimbola', 'bunmi', 'temitope',
  'toluwalope', 'omolara', 'folasade', 'uchechi', 'obiageli',
  'oluwatoyin', 'oluwakemi', 'oluwafunmilayo',

  // ── Somali ───────────────────────────────────────────────────────────────
  // Male
  'abdi', 'abdullahi', 'mohamud', 'mahad', 'mukhtar', 'salaad',
  'idiris', 'daud', 'jama', 'nuur', 'khadar', 'faarax',
  // Female
  'faadumo', 'hodan', 'sagal', 'nasrin', 'ifrah', 'nasro', 'khadra',
  'deeqa', 'halima', 'fadumo', 'nasteho', 'bilan', 'ayan', 'shukri',
  'filsan', 'nimco', 'leyla', 'ladan', 'warsan', 'roda', 'amina',
  'qamar', 'sahra', 'asad',

  // ── Polish ───────────────────────────────────────────────────────────────
  // Male
  'piotr', 'marek', 'tomasz', 'jakub', 'michal', 'grzegorz', 'pawel',
  'lukasz', 'andrzej', 'krzysztof', 'mariusz', 'dariusz', 'slawomir',
  'rafal', 'maciej', 'bartosz', 'wojciech', 'marcin', 'kamil',
  'patryk', 'mateusz', 'dawid', 'radoslaw', 'przemyslaw', 'zbigniew',
  'tadeusz', 'stanislaw', 'kazimierz', 'ryszard', 'wieslaw',
  'cezary', 'grzegorz', 'henryk', 'ireneusz', 'jaroslaw', 'leszek',
  // Female
  'katarzyna', 'malgorzata', 'agnieszka', 'krystyna', 'joanna',
  'magdalena', 'monika', 'zofia', 'karolina', 'aleksandra', 'paulina',
  'weronika', 'marta', 'beata', 'halina', 'ewa', 'bozena', 'danuta',
  'jadwiga', 'irena', 'teresa', 'grazyna', 'dorota', 'elzbieta',
  'iwona', 'jolanta', 'kinga', 'lidia', 'natalia', 'urszula',

  // ── Romanian ─────────────────────────────────────────────────────────────
  // Male
  'ioan', 'mihai', 'bogdan', 'radu', 'claudiu', 'vlad', 'ciprian',
  'marian', 'florin', 'sorin', 'adrian', 'constantin', 'vasile',
  'ion', 'gheorghe', 'octavian', 'dragos', 'cosmin', 'liviu',
  'laurentiu', 'razvan', 'stefan', 'valentin', 'alin', 'catalin',
  // Female
  'ioana', 'andreea', 'mihaela', 'roxana', 'alina', 'denisa', 'larisa',
  'raluca', 'anca', 'gabriela', 'camelia', 'luminita', 'simona',
  'oana', 'dana', 'corina', 'florentina', 'ionela', 'nicoleta',
  'valentina', 'ramona', 'bianca', 'loredana', 'catalina', 'rodica',
  'cornelia', 'liliana', 'mariana', 'cristiana', 'adriana',

  // ── Caribbean / African-Caribbean ────────────────────────────────────────
  // Male
  'delroy', 'everton', 'leroy', 'clive', 'desmond', 'winston', 'lloyd',
  'neville', 'fitzroy', 'carlton', 'barrington', 'errol', 'lennox',
  'rudolph', 'orville', 'dwayne', 'marlon', 'courtney',
  // Female
  'beverley', 'yvonne', 'paulette', 'marcia', 'hyacinth', 'sonia',
  'claudette', 'lorraine', 'yvette', 'cherelle', 'tanisha', 'latoya',
  'shanique', 'kadesha', 'nadine',

  // ── Ghanaian (Akan / Ga) ─────────────────────────────────────────────────
  // Male
  'kwame', 'kofi', 'kojo', 'kweku', 'kwabena', 'yaw', 'kwasi', 'ato',
  'nii', 'kobina', 'agyei', 'fiifi', 'ekow', 'kweku',
  // Female
  'akosua', 'akua', 'abena', 'amma', 'efua', 'adwoa', 'esi',
  'adjoa', 'ewurama', 'akweley', 'naa', 'akorfa',

  // ── West African — Mande / Fula / Wolof (Guinea, Senegal, Gambia, Sierra Leone)
  // This community is significant in UK cities (London, Birmingham, Manchester).
  // 'amara' is the key addition requested: Mandinka/Fula male name, very common.
  // Male
  'amara', 'mamadou', 'ibrahima', 'abdoulaye', 'boubacar', 'moussa',
  'oumar', 'seydou', 'modou', 'foday', 'lansana', 'siaka',
  'bockarie', 'allieu', 'umaru', 'sorie', 'amadu', 'lamin', 'ebrima',
  'dodou', 'bakary', 'samba', 'ousmane', 'amadou', 'demba', 'aliou',
  // Female
  'fatoumata', 'mariama', 'kadiatou', 'aissatou', 'binta', 'mariatu',
  'aminata', 'fatmata', 'kadiatu', 'isatu', 'rokhaya', 'coumba',
  'ndeye', 'astou', 'awa', 'ndey', 'kumba', 'nyima', 'haddy',

  // ── Ethiopian / Eritrean ──────────────────────────────────────────────────
  // Male
  'abebe', 'tekle', 'haile', 'dawit', 'solomon', 'bereket', 'yonas',
  'samuel', 'mihret', 'biruk', 'ermias', 'daniel', 'yohannes',
  // Female
  'hana', 'tigist', 'miriam', 'selam', 'rahel', 'meron', 'helen',
  'bethlehem', 'yordanos', 'asmara', 'semhal', 'tsehay',

  // ── Chinese / East Asian (romanised names common in UK documents) ─────────
  //
  // Design note (Chrome Extension best practice — false positive prevention):
  // Single-syllable romanised Chinese names that are ALSO common English words
  // or proper nouns are intentionally EXCLUDED from this gazetteer:
  //
  //   'ming'  → "Ming Dynasty" (proper noun)
  //   'hong'  → "Hong Kong"    (major proper noun)
  //   'fang'  → "Fang Attack"  (snake fang / English noun)
  //   'gang'  → "Gang Crime"   (criminal gang / English noun)
  //   'bin'   → "Bin Collection" (rubbish bin / English noun)
  //   'chi'   → "Chi Squared"  (Greek letter / statistics term)
  //   'ping'  → "Ping Test"    (network tool / English verb)
  //   'wing'  → "Wing Commander" (aviation / military title)
  //   'tao'   → "Tao Philosophy" (philosophy proper noun)
  //   'pak'   → "Pak Choi"     (vegetable / airline abbreviation)
  //
  // These names are still detected when surrounded by a context keyword:
  //   "Name: Ming Chen" → context keyword "Name:" triggers detection ✓
  //
  // Two-syllable compound names (e.g. "Xiuying") are unambiguous and safe.
  //
  // Safe single syllables kept (no English collision):
  'wei', 'lei', 'lin', 'jun', 'jing', 'ying', 'yan', 'mei', 'xia', 'xin',
  'ling', 'wai', 'siu',
  // Two-syllable compound Chinese given names — unambiguous, no English collision
  'xiuying', 'xiulan', 'meiling', 'xiaoming', 'xiaoling', 'xiaomei',
  'weiming', 'jianhua', 'guowei', 'junwei', 'mingwei', 'haoran',
  'yichen', 'zixuan', 'yifei', 'xinyi', 'wanying', 'yuting', 'yumei',
  'ruoxi', 'tianyi', 'ziyang', 'jiaming', 'lingfei', 'yuning',

  // ── Vietnamese ───────────────────────────────────────────────────────────
  // 'hung' excluded — "Hung Parliament" / "Hung Jury" are common English phrases
  'tuan', 'minh', 'huy', 'nam', 'duc', 'thang', 'quang',
  'phong', 'linh', 'lan', 'hoa', 'mai', 'thu', 'huong', 'thuy',
  'phuong', 'thi', 'bich', 'dung', 'hanh', 'khanh', 'ngoc', 'tuyen',

  // ── Eastern European (Russian / Ukrainian / Bulgarian / Czech / Slovak) ──
  // Male
  'dmitri', 'ivan', 'sergei', 'nikolai', 'alexei', 'boris', 'igor',
  'viktor', 'oleg', 'yuri', 'andrei', 'pavel', 'konstantin', 'mikhail',
  'vladislav', 'stanislav', 'vasily', 'gennady', 'anatoly', 'valery',
  'petr', 'roman', 'ruslan', 'artem', 'maksim', 'denys', 'mykola',
  'oleksandr', 'bohdan', 'taras', 'volodymyr',
  // Female
  'tatiana', 'olga', 'irina', 'svetlana', 'natalya', 'galina',
  'larissa', 'ludmila', 'lyudmila', 'zinaida', 'nadya', 'oksana',
  'yulia', 'darya', 'polina', 'veronika', 'alena', 'kristina',
  'ekaterina', 'maryna', 'olena', 'iryna', 'nataliia',

  // ── Spanish / Latin American ──────────────────────────────────────────────
  // Male
  'carlos', 'juan', 'miguel', 'jose', 'luis', 'jorge', 'pedro',
  'rafael', 'fernando', 'diego', 'manuel', 'alejandro', 'pablo',
  'sergio', 'javier', 'ivan', 'oscar', 'hector', 'rodrigo', 'alberto',
  // Female
  'isabella', 'camila', 'lucia', 'valeria', 'sara', 'paula', 'andrea',
  'natalia', 'patricia', 'angela', 'silvia', 'cristina', 'lorena',
  'pilar', 'rosa', 'elena', 'beatriz', 'concepcion', 'carmen', 'dolores',

  // ── Portuguese / Brazilian ────────────────────────────────────────────────
  // Male
  'joao', 'luis', 'pedro', 'carlos', 'paulo', 'antonio', 'manuel',
  'tiago', 'miguel', 'nuno', 'rui', 'diogo', 'rodrigo', 'gustavo',
  // Female
  'ana', 'sofia', 'beatriz', 'rita', 'inês', 'margarida', 'carolina',
  'marta', 'joana', 'filipa', 'catarina', 'teresa', 'francisca',
]);

// ─── Negative Adjective Gate ─────────────────────────────────────────────────
//
// NON_NAME_STARTERS: words that virtually NEVER appear as a person's first name
// in English.  If the FIRST word of a capitalised sequence is in this set, the
// sequence is rejected — UNLESS that first word also appears in COMMON_FIRST_NAMES
// (which always wins, ensuring e.g. "Max Johnson" is never blocked).
//
// Rationale: person given names come from a fixed cultural proper-noun lexicon;
// product/UI names are assembled from common adjectives and quantifiers.
// Blocking adjective-led sequences removes the primary source of false positives
// ("Smart Redaction", "Hybrid Detection", "Local Dashboard", etc.) without
// touching recall for real names.

const NON_NAME_STARTERS = new Set([
  // Quantity / degree
  'zero', 'single', 'dual', 'triple', 'multi', 'total', 'full', 'half',
  'all', 'ultra', 'mega', 'mini', 'micro', 'nano',
  // Quality / feature adjectives
  'smart', 'advanced', 'enhanced', 'improved', 'optimized', 'optimised',
  'premium', 'pro', 'plus', 'elite', 'standard', 'classic', 'basic',
  'robust', 'reliable', 'secure', 'safe', 'trusted', 'verified',
  'unified', 'integrated', 'automated', 'streamlined',
  // Temporal / state
  'new', 'next', 'final', 'last', 'first', 'latest', 'modern', 'legacy',
  'live', 'real', 'instant', 'rapid', 'fast', 'quick', 'auto',
  // Technology / platform descriptors
  'hybrid', 'native', 'local', 'remote', 'global', 'universal',
  'digital', 'virtual', 'physical', 'static', 'dynamic', 'async', 'sync',
  'custom', 'generic', 'default', 'built',
  // Scale / direction
  'major', 'minor', 'primary', 'secondary', 'main', 'core', 'base',
  'top', 'bottom', 'high', 'low', 'big', 'large', 'small', 'deep',
  'long', 'short', 'wide', 'narrow', 'broad', 'cross', 'edge',
  // Access / visibility
  'open', 'closed', 'public', 'private', 'shared', 'common',
  'direct', 'indirect', 'internal', 'external',
  // Appearance / design
  'dark', 'light', 'bright', 'clean', 'clear', 'sharp', 'bold',
  'slim', 'soft', 'hard', 'raw', 'pure', 'true', 'rich',
  // Prefix-style compound starters
  'super', 'over', 'under', 'self', 'pre', 'post', 'sub', 'non', 'anti',
  // Misc product / marketing copy
  'easy', 'free', 'best', 'better', 'simple', 'powerful', 'flexible',
  'comprehensive', 'complete', 'efficient', 'effective',
]);

// ─── False Positive Phrase List ───────────────────────────────────────────────
//
// Exact capitalised phrases and individual words that must never be flagged
// as names regardless of context.

export const FALSE_POSITIVES = new Set([
  // Clinical / medical document headers
  'urgent referral', 'urgent care', 'accident emergency',
  'patient report', 'medical report', 'discharge summary',
  'referral letter', 'clinical notes', 'consultation notes',
  'lab results', 'test results',
  // Form field labels
  'patient name', 'full name', 'first name', 'last name', 'surname',
  'date of birth', 'nhs number', 'ni number', 'phone number', 'email address',
  'passport no', 'passport number', 'vat number',
  'home address', 'post code', 'postcode', 'emergency contact',
  'contact name', 'referred by', 'referring gp', 'gp name',
  'next of kin', 'relationship to patient',
  // Salutation phrases
  'dear sir', 'dear madam', 'dear patient',
  'best regards', 'kind regards', 'yours sincerely',
  'thank you', 'please find', 'please note',
  'see attached', 'see below',
  // Org / place type words
  'medical centre', 'health centre', 'nhs trust',
  'high street', 'reference number',
  'confidential', 'private', 'restricted',
  // Common single-word false triggers
  'name', 'address', 'email', 'phone', 'dob', 'gp',
  'report', 'number', 'reference', 'details',
  'patient', 'medical', 'clinical', 'emergency',
  'referred', 'contact', 'department', 'section',
  'dear', 'regards', 'please', 'attached',
  'applicable', 'required', 'internal', 'sensitive',
  'line one', 'line two', 'line three', 'has no', 'no pii',
  'sort code', 'account number',
  // Generic document / UI phrases
  'support team', 'customer service', 'help desk', 'service desk',
  'next page', 'back page', 'front page', 'cover page',
  'page one', 'page two', 'section one', 'section two',
  'part one', 'part two', 'step one', 'step two',
  'privacy policy', 'terms conditions', 'data protection',
  'access request', 'subject access', 'data subject',
  'information commissioner', 'ico complaint',
  'human resources', 'head office', 'registered office',
  'general practice', 'ward manager', 'nurse practitioner', 'senior consultant',
  // Product / design phrases
  'core product concept', 'product design consultant',
  'root cause identification', 'curated product mapping', 'direct commerce links',
  'tactile digital experience', 'premium dark minimalist', 'cosmic product canvas',
  'verification plan', 'validation report', 'audit trail', 'review progress',
  'security policy', 'compliance guideline', 'system architecture',
  'technical specification', 'project summary', 'status update',
  // Dual-use name false positives — names that also appear in common English phrases.
  // These phrases are added here so the individual name word can remain in
  // COMMON_FIRST_NAMES (enabling detection of e.g. "Grace Thompson") while
  // preventing false positives when the name word pairs with a non-name word.
  // Grace
  'grace period', 'grace note', 'grace time',
  // Amber
  'amber alert', 'amber light', 'amber warning', 'amber list',
  // Ivy
  'ivy league', 'ivy bridge',
  // Rose / Ruby
  'rose gold', 'rose hip', 'rose garden', 'ruby red',
  // Dawn
  'dawn raid', 'dawn chorus',
  // Iris
  'iris scanner', 'iris recognition',
  // Violet
  'violet light',
  // Alpha (also kept out of COMMON_FIRST_NAMES — see comment above)
  'alpha version', 'alpha test', 'alpha testing', 'alpha channel', 'alpha male', 'alpha release',
  // Scarlett / Holly
  'scarlett fever',
  // Holly
  'holly bush', 'holly tree',
  // Lily / Daisy
  'lily pad', 'daisy chain', 'daisy wheel',
  // Mark (common male name — only block clear non-name compound forms)
  'mark up', 'mark down', 'mark scheme',
  // Frank / Dean
  'frank discussion', 'frank assessment', 'dean list',
  // Hazel
  'hazel nut', 'hazel tree',
]);

// ─── UI / tech vocabulary (density check for 3-word phrases) ─────────────────
//
// If ≥34% of the words in a 3-word sequence are in this set AND there is no
// context keyword or known first name, the phrase is rejected.

const UI_DESIGN_WORDS = new Set([
  'tactile', 'digital', 'experience', 'premium', 'minimalist', 'dark', 'light',
  'theme', 'mode', 'system', 'dashboard', 'product', 'design', 'concept',
  'multimodal', 'intelligence', 'problem', 'root', 'cause', 'identification',
  'mapping', 'curated', 'commerce', 'links', 'core', 'direct', 'solution',
  'interface', 'workflow', 'strategy', 'optimization', 'analytics', 'platform',
  'canvas', 'cosmic', 'universe', 'creative', 'visual', 'engine', 'studio',
  'verification', 'validation', 'report', 'audit', 'review', 'plan', 'specification',
  'requirement', 'document', 'summary', 'policy', 'compliance',
  'guideline', 'checklist', 'infrastructure', 'environment', 'production',
  'development', 'status', 'progress', 'update', 'feedback', 'support',
  'security', 'final', 'primary', 'secondary', 'internal', 'external',
]);

// ─── Regex patterns ───────────────────────────────────────────────────────────

// "Dr Ahmed", "Mrs Elizabeth Clarke" — high confidence, title provides context
// Uses [ \t]+ (not \s+) to prevent matching across newlines
const RE_TITLE_NAME = /\b(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?|Rev\.?|Cllr\.?)[ \t]+[A-Z\u00c0-\u00de][a-z\u00e0-\u00fe]+(?:[ \t]+[A-Z\u00c0-\u00de][a-z\u00e0-\u00fe]+){0,2}(?![a-z\u00e0-\u00fe])/g;

// "John Smith" or "Sarah Elizabeth Johnson" — 2–3 capitalised words, same line
const RE_NAME = /\b([A-Z\u00c0-\u00de][a-z\u00e0-\u00fe]{1,}(?:[ \t]+[A-Z\u00c0-\u00de][a-z\u00e0-\u00fe]{1,}){1,2})(?![a-z\u00e0-\u00fe])/g;

// "PATIENT: MARIA ESTEBAN" — all-caps formal document headers
const RE_ALLCAPS_NAME = /\b([A-Z\u00c0-\u00de]{2,}(?:[ \t]+[A-Z\u00c0-\u00de]{2,}){1,3})/g;

// Text BEFORE a match that signals a name follows
const RE_NAME_CONTEXT = /\b(full\s*name\s*[:\-]?|name\s*[:\-]|named?|patient\s*[:\-]?|from|to|dear|signed?\s*by|referred\s*by|contact|regarding|re[:\s]|about|cc[:\s]|for|hello|hi|sender|recipient|author|written\s*by|submitted\s*by|prepared\s*by|reviewed\s*by|regards|sincerely|cheers|thanks|yours|egress\s*[:\-]?)[,.]?\s*$/i;

// Text AFTER a match that confirms it was a name
const LABEL_LOOKAHEAD = /^\s*(email|phone|address|dob|date|tel|mobile|postcode)\s*[:\-]/i;

// Very common short words that should never be part of a name on their own
const COMMON_WORDS = new Set([
  'has', 'no', 'is', 'it', 'in', 'on', 'at', 'to', 'of', 'or', 'and',
  'the', 'a', 'an', 'be', 'was', 'are', 'for', 'with', 'this', 'that',
  'line', 'page', 'step', 'part', 'item', 'note', 'see', 'per',
  'new', 'old', 'all', 'any', 'not', 'but', 'if', 'by', 'up',
  'via', 're', 'cc', 'hi', 'my', 'our', 'your', 'their', 'its',
]);

// ─── Salutation / preposition starters ───────────────────────────────────────
//
// When the regex captures a salutation as the first word of a match (e.g.
// "Dear Hodan Jama"), that word provides context but is NOT part of the name.
// Sequences starting with one of these words have the leading word stripped
// and `impliedContext` set to true so the remaining name is evaluated correctly.
//
// This fixes the core false-negative: "Dear Hodan Jama" was previously rejected
// because 'dear' appears in FALSE_POSITIVES, so the real name was never seen.

const CONTEXT_STARTERS = new Set([
  'dear', 'from', 'to', 'hi', 'hello', 'for', 'thanks',
  'regards', 'sincerely', 'cheers', 'yours', 'cc', 're',
]);

// ─── Main detector ────────────────────────────────────────────────────────────

export function detectNames(text, claimed) {
  const risks = [];
  let match;

  // ── Pass 1: Title-prefixed names ─────────────────────────────────────────
  // "Dr Ahmed", "Mrs Elizabeth Clarke", "Prof Singh"
  // Title provides unambiguous context so no further checks needed.
  RE_TITLE_NAME.lastIndex = 0;
  while ((match = RE_TITLE_NAME.exec(text)) !== null) {
    const raw = match[0].trim();
    const start = match.index;
    const end = start + raw.length;
    if (isOverlapping(claimed, start, end)) continue;
    risks.push(makeRisk('name', raw, start, end, 0.92));
    claimSpan(claimed, start, end);
  }

  // ── Pass 2: Capitalised-word sequences ───────────────────────────────────
  RE_NAME.lastIndex = 0;
  while ((match = RE_NAME.exec(text)) !== null) {
    const raw = match[0].trim();
    const lower = raw.toLowerCase();
    const start = match.index;
    const end = start + raw.length;

    if (isOverlapping(claimed, start, end)) continue;

    // ① Exact-phrase false positive (e.g. "Sort Code", "High Street")
    if (FALSE_POSITIVES.has(lower)) continue;

    const words = lower.split(/\s+/);

    // ② All words are known non-name terms (e.g. "Dear Patient")
    if (words.every(w => FALSE_POSITIVES.has(w))) continue;

    // ③ Salutation / preposition stripping ────────────────────────────────
    // If the first captured word is a context word ("Dear", "From", "Hi"),
    // strip it from the match and treat the remainder as the name candidate.
    // The stripped word itself provides the context signal.
    //
    // Example: "Dear Hodan Jama"
    //   Before strip: words = ['dear','hodan','jama'] — 'dear' in FALSE_POSITIVES
    //                 would wrongly block the whole match.
    //   After  strip: evalWords = ['hodan','jama'], impliedContext = true ✓
    let evalWords      = words;
    let evalRaw        = raw;
    let evalStart      = start;
    let impliedContext = false;

    if (CONTEXT_STARTERS.has(words[0]) && words.length >= 2) {
      const trimOffset = raw.indexOf(' ') + 1;
      evalRaw        = raw.slice(trimOffset);
      evalStart      = start + trimOffset;
      evalWords      = evalRaw.toLowerCase().split(/\s+/);
      impliedContext = true;
    }

    // ④ Any word in the (trimmed) name is a known non-name term
    if (evalWords.some(w => FALSE_POSITIVES.has(w))) continue;

    // ⑤ Contains a very common short word (only meaningful for 2-word names)
    if (evalWords.length === 2 && evalWords.some(w => COMMON_WORDS.has(w))) continue;

    // ── STEP A: Positive signal — is the first (name) word a known given name?
    // Evaluated BEFORE the NON_NAME_STARTERS gate so "Max Johnson" and
    // "Rich Evans" are never blocked by the adjective/descriptor list.
    const firstWordIsKnownName = COMMON_FIRST_NAMES.has(evalWords[0]);

    // ── STEP B: Negative gate — adjective / descriptor starters ──────────
    // Reject sequences whose first name-word is a product adjective, UNLESS
    // it is also a recognised given name (STEP A always takes priority).
    if (!firstWordIsKnownName && NON_NAME_STARTERS.has(evalWords[0])) continue;

    // ── STEP C: Gather context signals ───────────────────────────────────
    const before = text.slice(Math.max(0, evalStart - 40), evalStart);
    const after  = text.slice(end, end + 30);
    // impliedContext covers salutations captured inside the match (see ③ above)
    const hasContext    = impliedContext || RE_NAME_CONTEXT.test(before);
    const hasLabelAfter = LABEL_LOOKAHEAD.test(after);

    // ── STEP D: Confidence scoring ────────────────────────────────────────
    //   0.92 — known first name + explicit context
    //   0.88 — explicit context only
    //   0.85 — follow-up PII label (email:, dob:, phone:, …)
    //   0.78 — first word is a known given name, no context
    //   0.65 — no positive signal (only reachable for 3-word sequences)
    const confidence =
        (firstWordIsKnownName && hasContext) ? 0.92
      : hasContext                            ? 0.88
      : hasLabelAfter                         ? 0.85
      : firstWordIsKnownName                  ? 0.78
      :                                         0.65;

    // ── STEP E: Threshold rules ───────────────────────────────────────────
    // 2-word: needs at least one positive signal (context, label, known name)
    if (evalWords.length <= 2 && !hasContext && !hasLabelAfter && !firstWordIsKnownName) continue;

    // 3-word: needs known first name OR explicit context.
    // Without either, apply UI-word density check (≥34% → reject).
    if (evalWords.length >= 3 && !hasContext && !hasLabelAfter && !firstWordIsKnownName) {
      const uiCount = evalWords.filter(w => UI_DESIGN_WORDS.has(w)).length;
      if (uiCount / evalWords.length >= 0.34) continue;
      if (confidence < 0.70) continue;
    }

    risks.push(makeRisk('name', evalRaw, evalStart, end, confidence));
    claimSpan(claimed, evalStart, end);
  }

  // ── Pass 3: ALL-CAPS names in formal headers ─────────────────────────────
  // "PATIENT: MARIA ESTEBAN GARCIA" — requires explicit name-indicator before
  RE_ALLCAPS_NAME.lastIndex = 0;
  while ((match = RE_ALLCAPS_NAME.exec(text)) !== null) {
    const raw   = match[1].trim();
    const lower = raw.toLowerCase();
    const start = match.index;
    const end   = start + raw.length;

    if (isOverlapping(claimed, start, end)) continue;
    if (FALSE_POSITIVES.has(lower)) continue;

    const words = lower.split(/\s+/);
    if (words.length < 2) continue;
    if (words.every(w => FALSE_POSITIVES.has(w))) continue;
    if (words.some(w => FALSE_POSITIVES.has(w))) continue;
    if (words.some(w => COMMON_WORDS.has(w))) continue;

    const before = text.slice(Math.max(0, start - 50), start);
    if (!RE_NAME_CONTEXT.test(before)) continue;

    risks.push(makeRisk('name', raw, start, end, 0.85));
    claimSpan(claimed, start, end);
  }

  return risks;
}
