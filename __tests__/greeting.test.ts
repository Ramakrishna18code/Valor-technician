import { greetingForHour } from '../src/utils/greeting';
test.each([[0,'Good evening'],[4,'Good evening'],[5,'Good morning'],[11,'Good morning'],[12,'Good afternoon'],[16,'Good afternoon'],[17,'Good evening'],[23,'Good evening']])('local hour %s uses %s', (hour, greeting) => { expect(greetingForHour(Number(hour))).toBe(greeting); });
