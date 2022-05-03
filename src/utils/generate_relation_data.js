// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
import Database from '../database.js';
import Utils from '../utils.js';

async function run() {
  //const db = Database('sqlite:db.sqlite');
  const db = Database('postgres://localhost:5432/tumblr', {
  //  skipProcessingIndices: true
  });
  await db.sequelize.sync();
  console.log("Database connected");
  // let importer = new Importer(db,'/filename.zip');
  // await importer.run();
  // let processor = new Processor(db);
  // await processor.run();
  // let finalizer = new Finalizer(db);
  // await finalizer.run();
  let utils = new Utils(db);

  let blogs = await db.Blog.findAll();

  for (const blog of blogs) {
    let [results, ] = await db.sequelize.query("select blogs.name, count(distinct b.tumblr_id) from post_contents a join post_contents b on a.post_id = b.post_id and a.position = b.position - 1 join contents ac on a.content_id = ac.id join contents bc on b.content_id = bc.id join blog_names ab on ac.blog_name_id = ab.id join blogs on ab.blog_id = blogs.id where blogs.id != " + blog.id + " and bc.blog_name_id in (select id from blog_names where blog_id = " + blog.id + ") group by blogs.name order by count(*) desc limit 20;");

    for (const result of results) {
      console.log(blog.name + " " + result['name'] + " " + result['count']);
    }
  }

  // await utils.mergeBlogs('deadmanride','dukeofedinburgh');
  // await utils.mergeBlogs('spamdog','nomorespamdog');
  // await utils.mergeBlogs('pajorimre','pajjorimre');
  // await utils.mergeBlogs('akurvaanyadatbuttersreloaded','akurvaanyadatbuttersofficial');
  // await utils.mergeBlogs('mcwolfy','mcwolf42');
  // await utils.mergeBlogs('schulmeister','tamasbereczky');
  // await utils.mergeBlogs('schulmeister','satani-vadbarom-deactivated2019');
  // await utils.mergeBlogs('prolidepp','prolidepp-official');
  // await utils.mergeBlogs('gaear-grimsrud','gaear--grimsrud');
  // await utils.mergeBlogs('kozmodiszk-deactivated20191213','kozmodiszk-recycled', { type: 'name_match' });
  // await utils.mergeBlogs('betekert--erzelmek','sose-voltam-jo-neked', { type: 'name_match' });
  // await utils.mergeBlogs('lvrbrd-9','lvrbrd', { type: 'name_match' });
  // await utils.mergeBlogs('lvrbrd-101','lvrbrd', { type: 'name_match' });
  // await utils.mergeBlogs('lvrbrd-6','lvrbrd', { type: 'name_match' });
  // await utils.mergeBlogs('lvrbrd-113','lvrbrd', { type: 'name_match' });
  // await utils.mergeBlogs('lvrbrd-11','lvrbrd', { type: 'name_match' });
  // await utils.mergeBlogs('lvrbrd-2','lvrbrd', { type: 'name_match' });
  // await utils.mergeBlogs('lvrbrd-3','lvrbrd', { type: 'name_match' });
  // await utils.mergeBlogs('lvrbrd-7','lvrbrd', { type: 'name_match' });
  // await utils.mergeBlogs('lvrbrd-0','lvrbrd', { type: 'name_match' });
  // await utils.mergeBlogs('lvrbrd-333','lvrbrd', { type: 'name_match' });
  // await utils.mergeBlogs('lvrbrd-32','lvrbrd', { type: 'name_match' });
  // await utils.mergeBlogs('lvrbrd-100','lvrbrd', { type: 'name_match' });
  // await utils.mergeBlogs('lvrbrd-009','lvrbrd', { type: 'name_match' });
  // await utils.mergeBlogs('lvrbrd7','lvrbrd', { type: 'name_match' });
  // await utils.mergeBlogs('akt-koccan-botoz','kockazott-bacon-reloaded', { type: 'name_match' });
  // await utils.mergeBlogs('prolipropilen-deactivated201603','prolipropilen-reloaded', { type: 'name_match' });
  // await utils.mergeBlogs('bedoreginaaa-deactivated2018011','kisbabszem', { type: 'name_match' });
  // await utils.mergeBlogs('bedo-regi-deactivated20180405','kisbabszem', { type: 'name_match' });

  // await utils.mergeBlogs('bzthemigrantviking','bztheoldestviking', { type: 'name_match' });
  // await utils.mergeBlogs('bzthemiddleagedviking','bztheoldestviking', { type: 'name_match' });

  //await utils.mergeBlogs('neduddgi','jeges', { type: 'known_link' });

  // await utils.mergeBlogs('papageorgeisback','dukeofedinburgh', { type: 'name_match' });

  // await utils.mergeBlogs('ittsarkanyokvoltak','pirisa', { type: 'name_match' });

  // await utils.mergeBlogs('perverzmagyarsracofficial2017','perverzmagyarsrac', { type: 'name_match' });
  // await utils.mergeBlogs('perverzmagyarsrac0-24','perverzmagyarsrac', { type: 'name_match' });
  // await utils.mergeBlogs('perverzmagyarsracofficial','perverzmagyarsrac', { type: 'name_match' });

  // await utils.mergeBlogs('csiribirifospuska-deactivated20','csiribirifospuskaujraitt', { type: 'name_match' });

  // await utils.mergeBlogs('szittyokapitany','szittyokapitanyoffical', { type: 'name_match' });

  // await utils.mergeBlogs('telaviv-delhi','telavivdelhi2', { type: 'name_match' });

  // await utils.mergeBlogs('prolitologusreloaded','elektroooo', { type: 'name_match' });
  // await utils.mergeBlogs('prolitologusurgyalogsag','elektroooo', { type: 'name_match' });
  // await utils.mergeBlogs('prolitologusofficial','elektroooo', { type: 'name_match' });
  // await utils.mergeBlogs('prolitologuspacemarine-deactiva','elektroooo', { type: 'name_match' });
  // await utils.mergeBlogs('pr0litologus','elektroooo', { type: 'name_match' });

  // await utils.mergeBlogs('funkyparduc','funkyparducofficial', { type: 'name_match' });

  // await utils.mergeBlogs('nureinzeekoo','masikzeekoo', { type: 'name_match' });

  // await utils.mergeBlogs('stukkeruva2000','stukkeruva', { type: 'name_match' });
  // await utils.mergeBlogs('stukkeruvastk','stukkeruva', { type: 'name_match' });

  // await utils.mergeBlogs('drkotasz','drkotttasz', { type: 'name_match' });

  // await utils.mergeBlogs('fotelgombasz','fotelgombasz2', { type: 'name_match' });

  // await utils.mergeBlogs('rumcajszofficial','rumcajsz', { type: 'name_match' });
  // await utils.mergeBlogs('rumcajszterror','rumcajsz', { type: 'name_match' });
  // await utils.mergeBlogs('rumcajszkalandjai','rumcajsz', { type: 'name_match' });
  // await utils.mergeBlogs('rumcajszesmanka','rumcajsz', { type: 'name_match' });

  // await utils.mergeBlogs('ekkerjoz', 'ekkerjozsef', { type: 'name_match' });

  // await utils.mergeBlogs('mardredka','mardred', { type: 'name_match' });
  // await utils.mergeBlogs('mardredreborn','mardred', { type: 'name_match' });

  // await utils.mergeBlogs('kosullo-blog', 'kosullo2', { type: 'name_match' });

  // await utils.mergeBlogs('politikapolka2','politikapolka', { type: 'name_match' });

  // await utils.mergeBlogs('peppperedmind','mspepperpotts', { type: 'name_match' });

  // await utils.mergeBlogs('zitasagaim2pont0','zitasagaim2pont0-deactivated202',{type: 'deactivated'});
  // await utils.mergeBlogs('waldheimrudi','waldheimrudi-deactivated2021062',{type: 'deactivated'});
  // await utils.mergeBlogs('viki-ped1a','viki-ped1a-deactivated20161127',{type: 'deactivated'});
  // await utils.mergeBlogs('starsfromannahaller','vicent-van-gay-deactivated20201',{type: 'deactivated'});
  // await utils.mergeBlogs('venitimi','venitimi-deactivated20151115',{type: 'deactivated'});
  // await utils.mergeBlogs('unholy-annihilation','unholy-annihilation-deactivated',{type: 'deactivated'});
  // await utils.mergeBlogs('tropusok','tropusok-deactivated20170301',{type: 'deactivated'});
  // await utils.mergeBlogs('technonomore','szarazon-technon',{type: 'deactivated'});
  // await utils.mergeBlogs('szarkasztikuspingvin','szarkasztikuspingvin-deactivate',{type: 'deactivated'});
  // await utils.mergeBlogs('spacecreak','spacecreak-deactivated20191107',{type: 'deactivated'});
  // await utils.mergeBlogs('sniperpony','sniperpony-deactivated20140531',{type: 'deactivated'});
  // await utils.mergeBlogs('sisioner','sisioner-deactivated20150217',{type: 'deactivated'});
  // await utils.mergeBlogs('simplyboci','simplyboci-deactivated20170103',{type: 'deactivated'});
  // await utils.mergeBlogs('selefthereia','szlfthria',{type: 'deactivated'});
  // await utils.mergeBlogs('tamasbereczky','schulmeister-deactivated2016070',{type: 'deactivated'});
  // await utils.mergeBlogs('rivieree','rivieree-deactivated20140815',{type: 'deactivated'});
  // await utils.mergeBlogs('reszeg-kolto-gatya-nelkul','reszeg-kolto-gatya-nelkul-deact',{type: 'deactivated'});
  // await utils.mergeBlogs('redpowa','redpowa-deactivated20150521',{type: 'deactivated'});
  // await utils.mergeBlogs('reality-is-not-imagination','reality-is-not-imagination-deac',{type: 'deactivated'});
  // await utils.mergeBlogs('prolitologuspacemarine','prolitologuspacemarine-deactiva',{type: 'deactivated'});
  // await utils.mergeBlogs('prolipropilen','prolipropilen-deactivated201603',{type: 'deactivated'});
  // await utils.mergeBlogs('patricia101r','patricia101r-deactivated2016012',{type: 'deactivated'});
  // await utils.mergeBlogs('olgaszemjonova','olgaszemjonova-deactivated20170',{type: 'deactivated'});
  // await utils.mergeBlogs('napispam','napispam-deactivated20150703',{type: 'deactivated'});
  // await utils.mergeBlogs('digitaltos','nandifaszakivan-deactivated2015',{type: 'deactivated'});
  // await utils.mergeBlogs('mitiszunkma','mitiszunkma-deactivated20160507',{type: 'deactivated'});
  // await utils.mergeBlogs('mindenki-tapsol','mindenki-tapsol-deactivated2017',{type: 'deactivated'});
  // await utils.mergeBlogs('koalandoselet','mindenfoglaltmar-deactivated201',{type: 'deactivated'});
  // await utils.mergeBlogs('memety','memety-deactivated20150803',{type: 'deactivated'});
  // await utils.mergeBlogs('maripaan','maripaan-deactivated20150622',{type: 'deactivated'});
  // await utils.mergeBlogs('majdnem','majdnem-deactivated20130127',{type: 'deactivated'});
  // await utils.mergeBlogs('lovesickdesire','lovesickdesire-deactivated20170',{type: 'deactivated'});
  // await utils.mergeBlogs('lordkewljan','lordkewljan-deactivated20180619',{type: 'deactivated'});
  // await utils.mergeBlogs('leszokni-a-dohanyzasrol','leszokni-a-dohanyzasrol-deactiv',{type: 'deactivated'});
  // await utils.mergeBlogs('terroristahorcsog','lelekszavak-deactivated20201005',{type: 'deactivated'});
  // await utils.mergeBlogs('kiment','kiment-deactivated20170323',{type: 'deactivated'});
  // await utils.mergeBlogs('kiegettvillanykorte','kiegettvillanykorte-deactivated',{type: 'deactivated'});
  // await utils.mergeBlogs('prideofmom','jp-andre77-deactivated20210802',{type: 'deactivated'});
  // await utils.mergeBlogs('jajudit','jajudit-deactivated20170505',{type: 'deactivated'});
  // await utils.mergeBlogs('itsmarton','itsmarton-deactivated20160217',{type: 'deactivated'});
  // await utils.mergeBlogs('im-disappointed','im-disappointed-deactivated2020',{type: 'deactivated'});
  // await utils.mergeBlogs('henchika','henchika-deactivated20181215',{type: 'deactivated'});
  // await utils.mergeBlogs('hellolaca','hellolaca-deactivated20170103',{type: 'deactivated'});
  // await utils.mergeBlogs('gaear--grimsrud','gaear-grimsrud-deactivated',{type: 'deactivated'});
  // await utils.mergeBlogs('flrsmn','flrsmn-deactivated20160810',{type: 'deactivated'});
  // await utils.mergeBlogs('filctollgirl','filctollgirl-deactivated2016061',{type: 'deactivated'});
  // await utils.mergeBlogs('szentpetervar','feherliliom-deactivated20160609',{type: 'deactivated'});
  // await utils.mergeBlogs('eltiron','eltiron-deactivated20180910',{type: 'deactivated'});
  // await utils.mergeBlogs('distilled-percepti0n','distilled-percepti0n-deactivate',{type: 'deactivated'});
  // await utils.mergeBlogs('cukorral-vagy-anelkul','cukorral-vagy-anelkul-deactivat',{type: 'deactivated'});
  // await utils.mergeBlogs('csiribirifospuska','csiribirifospuska-deactivated20',{type: 'deactivated'});
  // await utils.mergeBlogs('cilkomblr','cilkomblr-deactivated20160122',{type: 'deactivated'});
  // await utils.mergeBlogs('cilko','cilko-deactivated20150906',{type: 'deactivated'});
  // await utils.mergeBlogs('bzandthetotalwasteoftime','bztheoldestviking-deactivated20',{type: 'deactivated'});
  // await utils.mergeBlogs('bsltlynthng','bsltlynthng-deactivated20160521',{type: 'deactivated'});
  // await utils.mergeBlogs('bizonytalan','bizonytalan-deactivated20211229',{type: 'deactivated'});
  // await utils.mergeBlogs('bedoregi','bedoreginaaa-deactivated2018011',{type: 'deactivated'});
  // await utils.mergeBlogs('bedo-regi','bedo-regi-deactivated20180405',{type: 'deactivated'});
  // await utils.mergeBlogs('bearnadett','bearnadett-deactivated20141018',{type: 'deactivated'});
  // await utils.mergeBlogs('batorfyattila','batorfyattila-deactivated201806',{type: 'deactivated'});
  // await utils.mergeBlogs('porta-del-paradiso','arvafiju-deactivated20150514',{type: 'deactivated'});
  // await utils.mergeBlogs('6li6li6','a-n-t-i-k-r-i-s-z-t-u-s-deactiv',{type: 'deactivated'});
  // await utils.mergeBlogs('a-kocsma-nemvot-nyitta','a-kocsma-nemvot-nyitta-deactiva',{type: 'deactivated'});
};

run();
