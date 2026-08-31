UPDATE "Doctor"
SET "avatarUrl" = CASE "phone"
  WHEN '0812-1000-1101' THEN 'https://plus.unsplash.com/premium_photo-1677165481551-c91ed6e15f09?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  WHEN '0812-1000-1102' THEN 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=687&auto=format&fit=crop'
  WHEN '0812-1000-1103' THEN 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?q=80&w=687&auto=format&fit=crop'
  WHEN '0812-1000-1104' THEN 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?q=80&w=687&auto=format&fit=crop'
  WHEN '0812-1000-1105' THEN 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=687&auto=format&fit=crop'
  WHEN '0812-1000-1106' THEN 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=687&auto=format&fit=crop'
  WHEN '0812-1000-1107' THEN 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?q=80&w=687&auto=format&fit=crop'
  WHEN '0812-1000-1108' THEN 'https://images.unsplash.com/photo-1527613426441-4da17471b66d?q=80&w=687&auto=format&fit=crop'
  WHEN '0812-1000-1109' THEN 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?q=80&w=687&auto=format&fit=crop'
  WHEN '0812-1000-1110' THEN 'https://images.unsplash.com/photo-1638202993928-7267aad84c31?q=80&w=687&auto=format&fit=crop'
  ELSE "avatarUrl"
END;
