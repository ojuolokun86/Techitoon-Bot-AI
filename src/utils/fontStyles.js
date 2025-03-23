const fonts = {
    "normal": (text) => text, // Default font
    "bold": (text) => text.replace(/a/g, '𝗮').replace(/b/g, '𝗯').replace(/c/g, '𝗰')
                           .replace(/d/g, '𝗱').replace(/e/g, '𝗲').replace(/f/g, '𝗳')
                           .replace(/g/g, '𝗴').replace(/h/g, '𝗵').replace(/i/g, '𝗶')
                           .replace(/j/g, '𝗷').replace(/k/g, '𝗸').replace(/l/g, '𝗹')
                           .replace(/m/g, '𝗺').replace(/n/g, '𝗻').replace(/o/g, '𝗼')
                           .replace(/p/g, '𝗽').replace(/q/g, '𝗾').replace(/r/g, '𝗿')
                           .replace(/s/g, '𝘀').replace(/t/g, '𝘁').replace(/u/g, '𝘂')
                           .replace(/v/g, '𝘃').replace(/w/g, '𝘄').replace(/x/g, '𝘅')
                           .replace(/y/g, '𝘆').replace(/z/g, '𝘇'),
    
    "italic": (text) => text.replace(/a/g, '𝘢').replace(/b/g, '𝘣').replace(/c/g, '𝘤')
                             .replace(/d/g, '𝘥').replace(/e/g, '𝘦').replace(/f/g, '𝘧')
                             .replace(/g/g, '𝘨').replace(/h/g, '𝘩').replace(/i/g, '𝘪')
                             .replace(/j/g, '𝘫').replace(/k/g, '𝘬').replace(/l/g, '𝘭')
                             .replace(/m/g, '𝘮').replace(/n/g, '𝘯').replace(/o/g, '𝘰')
                             .replace(/p/g, '𝘱').replace(/q/g, '𝘲').replace(/r/g, '𝘳')
                             .replace(/s/g, '𝘴').replace(/t/g, '𝘵').replace(/u/g, '𝘶')
                             .replace(/v/g, '𝘷').replace(/w/g, '𝘸').replace(/x/g, '𝘹')
                             .replace(/y/g, '𝘺').replace(/z/g, '𝘻'),
    
    "script": (text) => text.replace(/a/g, '𝒶').replace(/b/g, '𝒷').replace(/c/g, '𝒸')
                             .replace(/d/g, '𝒹').replace(/e/g, '𝑒').replace(/f/g, '𝒻')
                             .replace(/g/g, '𝑔').replace(/h/g, '𝒽').replace(/i/g, '𝒾')
                             .replace(/j/g, '𝒿').replace(/k/g, '𝓀').replace(/l/g, '𝓁')
                             .replace(/m/g, '𝓂').replace(/n/g, '𝓃').replace(/o/g, '𝑜')
                             .replace(/p/g, '𝓅').replace(/q/g, '𝓆').replace(/r/g, '𝓇')
                             .replace(/s/g, '𝓈').replace(/t/g, '𝓉').replace(/u/g, '𝓊')
                             .replace(/v/g, '𝓋').replace(/w/g, '𝓌').replace(/x/g, '𝓍')
                             .replace(/y/g, '𝓎').replace(/z/g, '𝓏'),

    // Add more fonts here...
};

module.exports = fonts;
