function calculateXpForNextLevel(level) {
    const base = 100;
    const exponent = 1.5;
    return Math.floor(base * Math.pow(level, exponent));
  }
  
  function addExperience(user_info, xpGained) {
    user_info.current_xp += xpGained;
  
    // Check if the user has enough XP to level up
    while (user_info.current_xp >= calculateXpForNextLevel(user_info.level)) {
      user_info.current_xp -= calculateXpForNextLevel(user_info.level);
      user_info.level += 1;
    }
  
    return user_info;
  }

  function subtractExperience(user_info, xpLost) {
    // Subtract XP from the user's current XP
    user_info.current_xp -= xpLost;
  
    // Ensure current XP does not fall below zero
    if (user_info.current_xp < 0) {
      user_info.current_xp = 0;
    }
  
    // Do not modify the level, even if XP falls below the level threshold
  
    return user_info;
  }
  export {calculateXpForNextLevel, addExperience, subtractExperience}