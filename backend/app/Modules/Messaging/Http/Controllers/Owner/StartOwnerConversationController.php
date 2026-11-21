<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Messaging\Actions\StartExternalConversation;
use App\Modules\Messaging\Data\NewExternalConversationData;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Http\Requests\OpenOwnerConversationRequest;
use App\Modules\Messaging\Queries\OwnerThreads;
use App\Modules\Messaging\Support\CounterpartDesk;
use App\Modules\Messaging\Support\MessageInput;
use App\Modules\Messaging\Support\OwnerWriteGate;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\JsonResponse;

final class StartOwnerConversationController
{
    public function __invoke(OpenOwnerConversationRequest $request, MandateDirectory $mandats, OwnerThreads $fils, OwnerWriteGate $garde, StartExternalConversation $demarrer, CounterpartDesk $bureau, CurrentOrganization $contexte): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $visible = $this->acces($mandats, $user->id, $request->accessId());
        $garde->assertCanOpen($visible);
        $mandat = $request->mandateId();

        $demarre = $contexte->run($visible->organizationId, function () use ($request, $mandats, $visible, $mandat, $demarrer, $user) {
            if ($mandat !== null && $mandats->find($mandat)->mandantPartyId !== $visible->mandantPartyId) {
                throw ErrorCode::ConversationLinkNotFound->problem();
            }

            return $demarrer->handle($user, MessageSide::Owner, new NewExternalConversationData(
                ConversationKind::Owner,
                $visible->mandantPartyId,
                null,
                $mandat,
                $request->subject(),
                MessageInput::body($request),
                MessageInput::attachments($request),
                MessageInput::clientId($request),
            ));
        });
        $fil = $fils->list($user->id, [$visible])->whereKey($demarre->conversation->id)->firstOrFail();

        return $bureau->show($fil, $user, true)->response()->setStatusCode($demarre->replayed ? 200 : 201);
    }

    private function acces(MandateDirectory $mandats, string $userId, string $accessId): OwnerVisibleData
    {
        foreach ($mandats->visibleToOwner($userId) as $visible) {
            if ($visible->accessId === $accessId) {
                return $visible;
            }
        }

        throw ErrorCode::ConversationLinkNotFound->problem();
    }
}
