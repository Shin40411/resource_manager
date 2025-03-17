import { Injectable } from '@nestjs/common';
import * as fs from 'fs';

@Injectable()
export class StatsService {
  getStats() {
    return (folder: string) => fs.readdirSync(folder).length;
  }
}
