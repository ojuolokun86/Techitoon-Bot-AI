const supabase = require('../supabaseClient');

const getPrefix = async () => {
    const { data, error } = await supabase
        .from('config')
        .select('prefix')
        .eq('id', 1)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            console.log('No prefix found, using default prefix.');
            return '.';
        }
        console.error('Error fetching prefix:', error);
        return '.';
    }
    return data.prefix;
};

const setPrefix = async (newPrefix) => {
    const { error } = await supabase
        .from('config')
        .upsert({ id: 1, prefix: newPrefix }, { onConflict: 'id' });

    if (error) {
        console.error('Error setting prefix:', error);
        return false;
    }
    return true;
};

module.exports = { getPrefix, setPrefix };