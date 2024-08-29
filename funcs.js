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


  export {calculateXpForNextLevel, addExperience}