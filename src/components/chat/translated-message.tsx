'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';
import { translate } from '@/ai/flows/translate-flow';
import { Separator } from '@/components/ui/separator';

type ChatFilters = {
  blockLinks?: boolean;
  blockProfanity?: boolean;
};

const profanityList = [
    'anal', 'anus', 'arse', 'ass', 'ass-hat', 'ass-jabber', 'ass-pirate', 'assbag', 'assbandit', 'assbanger', 'assbite', 'assclown', 'asscock', 'asscracker', 'asses', 'assface', 'assfuck', 'assfucker', 'assgoblin', 'asshat', 'asshead', 'asshole', 'asshopper', 'assjacker', 'asslick', 'asslicker', 'assmaster', 'assmonkey', 'assmunch', 'assmuncher', 'assnigger', 'asspirate', 'assshit', 'assshole', 'asssucker', 'asswad', 'asswipe', 'axwound', 'bampot', 'bastard', 'beaner', 'bitch', 'bitch-ass', 'bitch-tits', 'bitcher', 'bitchin', 'bitching', 'bitchtits', 'bitchy', 'blow job', 'blowjob', 'bollocks', 'bollox', 'boner', 'brotherfucker', 'bullshit', 'bumblefuck', 'butt plug', 'butt-pirate', 'buttfucka', 'buttfucker', 'camel toe', 'carpetmuncher', 'chesticle', 'chinc', 'chink', 'choad', 'chode', 'clit', 'clit-face', 'clitfuck', 'clusterfuck', 'cock', 'cock-jockey', 'cock-sucker', 'cockass', 'cockbite', 'cockburger', 'cockface', 'cockfucker', 'cockhead', 'cockholster', 'cockjockey', 'cockknocker', 'cockmaster', 'cockmongler', 'cockmongruel', 'cockmonkey', 'cockmuncher', 'cocknose', 'cocknugget', 'cockshit', 'cocksmith', 'cocksmoke', 'cocksmoker', 'cocksniffer', 'cocksucker', 'cockwaffle', 'coochie', 'coochy', 'coon', 'cooter', 'cracker', 'cum', 'cumbubble', 'cumdumpster', 'cumguzzler', 'cumjockey', 'cummer', 'cummin', 'cumming', 'cums', 'cumshot', 'cumslut', 'cumstain', 'cumtart', 'cunillingus', 'cunnie', 'cunnilingus', 'cunt', 'cunt-struck', 'cuntass', 'cuntface', 'cunthole', 'cuntlick', 'cuntlicker', 'cuntlapping', 'cunts', 'cuntslut', 'cyalis', 'cyberfuc', 'cyberfuck', 'cyberfucked', 'cyberfucker', 'cyberfuckers', 'cyberfucking', 'dago', 'damn', 'deggo', 'dick', 'dick-sneeze', 'dickbag', 'dickbeaters', 'dickface', 'dickfuck', 'dickfucker', 'dickhead', 'dickhole', 'dickjuice', 'dickmilk', 'dickmonger', 'dickslap', 'dicksucker', 'dicksucking', 'dicktickler', 'dickwad', 'dickweasel', 'dickweed', 'dickwod', 'dike', 'dildo', 'dildos', 'dillhole', 'dingleberr', 'dingleberry', 'dink', 'dinks', 'dipshit', 'dirsa', 'dlck', 'dog-fucker', 'doggie style', 'doggiestyle', 'doggin', 'dogging', 'donkeyribber', 'doochbag', 'doosh', 'douche', 'douche-fag', 'douchebag', 'douchewaffle', 'dumass', 'dumb ass', 'dumbass', 'dumbfuck', 'dumbshit', 'dummy', 'dyke', 'fag', 'fagbag', 'fagfucker', 'faggit', 'faggot', 'faggotcock', 'faggs', 'fagot', 'fagots', 'fags', 'fatass', 'fellatio', 'feltch', 'fisted', 'fisting', 'flamer', 'fuck', 'fuck-ass', 'fuck-bitch', 'fuck-off', 'fuckass', 'fuckbag', 'fuckboy', 'fuckbrain', 'fuckbuddy', 'fuckbutt', 'fuckbutter', 'fucked', 'fucker', 'fuckers', 'fuckersucker', 'fuckface', 'fuckhead', 'fuckhole', 'fuckin', 'fucking', 'fuckme', 'fucknut', 'fucknutt', 'fuckoff', 'fucks', 'fuckstick', 'fucktard', 'fucktart', 'fuckup', 'fuckwad', 'fuckwit', 'fuckwitt', 'fudge packer', 'fudgepacker', 'fuk', 'fuker', 'fukker', 'fukkin', 'fuks', 'fukwhit', 'fukwit', 'fux', 'fuxor', 'g-spot', 'gangbang', 'gangbanged', 'gangbangs', 'gayass', 'gaybob', 'gaydo', 'gaylord', 'gaytard', 'gaywad', 'god-damned', 'goddamn', 'goddamned', 'goddamnit', 'gooch', 'gook', 'gringo', 'guido', 'handjob', 'hard on', 'heeb', 'hell', 'ho', 'hoar', 'hoare', 'hoe', 'hoer', 'homo', 'homoerotic', 'honkey', 'hooker', 'hore', 'horny', 'hot carl', 'hot chick', 'howdo', 'hump', 'humping', 'jack-off', 'jackass', 'jackoff', 'jerk-off', 'jigaboo', 'jism', 'jiz', 'jizm', 'jizz', 'kawk', 'kike', 'klootzak', 'knob', 'knob-end', 'knobead', 'knobed', 'knobend', 'knobhead', 'knobjock', 'knobjockey', 'kock', 'kondum', 'kondums', 'kum', 'kumer', 'kummer', 'kummin', 'kumming', 'kums', 'kunilingus', 'kunt', 'kyke', 'lmfao', 'lube', 'mcfagget', 'mick', 'minge', 'mothafuck', 'mothafucka', 'mothafuckas', 'mothafuckaz', 'mothafucked', 'mothafucker', 'mothafuckers', 'mothafuckin', 'mothafucking', 'mothafuckings', 'mothafucks', 'mother fucker', 'motherfuck', 'motherfucked', 'motherfucker', 'motherfuckers', 'motherfuckin', 'motherfucking', 'motherfuckings', 'motherfuckka', 'motherfucks', 'muff', 'muffdiver', 'munging', 'negro', 'nigga', 'niggah', 'niggas', 'niggaz', 'nigger', 'niggers', 'nutsack', 'paki', 'panooch', 'pecker', 'peckerhead', 'penis', 'penis-breath', 'penisfucker', 'penispuffer', 'piss', 'pissed', 'pissed off', 'pisser', 'pissers', 'pisses', 'pissflaps', 'pissin', 'pissing', 'pissoff', 'polesmoker', 'pollock', 'poon', 'poonani', 'poonany', 'poontang', 'porch monkey', 'porchmonkey', 'prick', 'punanny', 'punta', 'pussies', 'pussy', 'pussy-lipped', 'pussylips', 'pussys', 'puto', 'queaf', 'queef', 'queer', 'queerbait', 'queerhole', 'renob', 'rimjob', 'ruski', 'sadist', 'sand nigger', 'sandnigger', 'schlong', 'scrote', 'scrotum', 'shemale', 'shit', 'shit-dick', 'shitass', 'shitbag', 'shitbagger', 'shitblimp', 'shitbrain', 'shitbreath', 'shitcanned', 'shitcunt', 'shitdick', 'shite', 'shited', 'shitey', 'shitface', 'shitfaced', 'shitfuck', 'shitfucker', 'shitfull', 'shithead', 'shithole', 'shithouse', 'shiting', 'shitspitter', 'shits', 'shitstain', 'shitted', 'shitter', 'shitters', 'shittiest', 'shitting', 'shittings', 'shitty', 'skank', 'skeet', 'slut', 'slut-bag', 'slutbag', 'sluts', 'smegma', 'spic', 'spick', 'splooge', 'spunk', 'tard', 'teabagging', 'teets', 'teez', 'testical', 'testicle', 'thundercunt', 'tit', 'tit-wank', 'titfuck', 'tits', 'titty', 'tittyfuck', 'tittyfucker', 'tittywank', 'titwank', 'tosser', 'turd', 'twat', 'twat-lips', 'twathead', 'twatlips', 'twats', 'twatwaffle', 'unclefucker', 'va-j-j', 'vag', 'vagina', 'viagra', 'vulva', 'wank', 'wanker', 'wankjob', 'whore', 'whore-bag', 'whorebag', 'whoreface', 'wop'
];
const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;

interface TranslatedMessageProps {
  text: string;
  filters: ChatFilters;
  isOwnMessage: boolean;
  language?: string;
}

export function TranslatedMessage({ text, filters, isOwnMessage, language = 'en' }: TranslatedMessageProps) {
  const [revealed, setRevealed] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const handleTranslate = async () => {
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const result = await translate({ text, targetLanguage: language });
      setTranslatedText(result.translatedText);
    } catch (error) {
      console.error('Translation failed:', error);
      setTranslationError('Could not translate message.');
    } finally {
      setIsTranslating(false);
    }
  };

  const checkFilter = () => {
    let reason = '';
    let isBlocked = false;

    if (filters.blockProfanity) {
      const words = text.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (profanityList.includes(word.replace(/[^a-zA-Z0-9]/g, ''))) {
          isBlocked = true;
          reason = 'Profanity';
          break;
        }
      }
    }

    if (!isBlocked && filters.blockLinks) {
      if (urlRegex.test(text)) {
        isBlocked = true;
        reason = 'Link';
      }
    }

    return { isBlocked, reason };
  };

  const { isBlocked, reason } = checkFilter();

  if (isBlocked && !revealed && !isOwnMessage) {
    return (
      <span
        className="cursor-pointer bg-muted text-muted-foreground px-2 py-1 rounded-md"
        onClick={() => setRevealed(true)}
      >
        Message hidden (Contains potential {reason}). Click to view.
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
            <p className="text-sm break-words">{text}</p>
            {!isOwnMessage && language !== 'en' && !translatedText && (
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleTranslate} disabled={isTranslating}>
                    <Languages className={`h-4 w-4 ${isTranslating ? 'animate-pulse' : ''}`} />
                </Button>
            )}
        </div>
      {translatedText && (
        <>
          <Separator />
          <p className="text-sm break-words opacity-80">{translatedText}</p>
        </>
      )}
      {translationError && (
        <>
          <Separator />
          <p className="text-xs text-destructive">{translationError}</p>
        </>
      )}
    </div>
  );
}
