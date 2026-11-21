<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\PostSupportMessage;
use App\Modules\Messaging\Http\Requests\ReplyRequest;
use App\Modules\Messaging\Http\Resources\TicketDetailResource;
use App\Modules\Messaging\Support\MessageInput;
use App\Modules\Messaging\Support\TicketLoader;

final class ReplyTicketController
{
    public function __invoke(ReplyRequest $request, string $ticket, PostSupportMessage $poster): TicketDetailResource
    {
        /** @var User $operateur */
        $operateur = $request->user();

        $poster->handle(TicketLoader::forSupport($ticket), $operateur, fromSupport: true, internal: $request->boolean('internal'), body: MessageInput::body($request), attachments: MessageInput::attachments($request), clientId: MessageInput::clientId($request));

        return new TicketDetailResource(TicketLoader::forSupport($ticket), vueSupport: true);
    }
}
