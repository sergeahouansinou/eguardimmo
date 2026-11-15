<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\PostSupportMessage;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Http\Requests\ReplyRequest;
use App\Modules\Messaging\Http\Resources\TicketDetailResource;
use App\Modules\Messaging\Support\MessageInput;
use App\Modules\Messaging\Support\TicketLoader;

final class ReplyMyTicketController
{
    public function __invoke(ReplyRequest $request, string $ticket, PostSupportMessage $poster): TicketDetailResource
    {
        /** @var User $user */
        $user = $request->user();
        $demande = TicketLoader::forRequester($request, $ticket);

        if ($demande->status === TicketStatus::Resolved) {
            throw ErrorCode::TicketResolved->problem();
        }

        $poster->handle($demande, $user, fromSupport: false, internal: false, body: MessageInput::body($request), attachments: MessageInput::attachments($request));

        return new TicketDetailResource(TicketLoader::forRequester($request, $ticket), vueSupport: false);
    }
}
