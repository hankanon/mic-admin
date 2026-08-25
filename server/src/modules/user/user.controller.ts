import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common'
import { UserService } from './user.service'
import { userCreateSchema, userUpdateSchema } from '../../common/schemas'

@Controller('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  list() {
    return this.userService.list()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.userService.get(Number(id))
  }

  @Post()
  create(@Body() body: unknown) {
    return this.userService.create(userCreateSchema.parse(body))
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.userService.update(Number(id), userUpdateSchema.parse(body))
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.userService.remove(Number(id))
    return null
  }
}
