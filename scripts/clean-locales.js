const fs = require('fs');
const path = require('path');

exports.default = async function (context) {
    const localeDir = path.join(context.appOutDir, 'locales');

    // Langues à conserver (Anglais et Français)
    const keepLocales = ['en-US.pak', 'fr.pak', 'en-GB.pak'];

    if (fs.existsSync(localeDir)) {
        const files = fs.readdirSync(localeDir);
        files.forEach(file => {
            if (!keepLocales.includes(file)) {
                try {
                    fs.unlinkSync(path.join(localeDir, file));
                } catch (err) {
                    // Ignorer les erreurs si le fichier est utilisé
                }
            }
        });
        console.log('  • Locales cleaned: only English and French kept.');
    }
};
