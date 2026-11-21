<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\StartExternalConversation;
use App\Modules\Messaging\Data\NewExternalConversationData;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Http\Requests\OpenTenantConversationRequest;
use App\Modules\Messaging\Queries\TenantThreads;
use App\Modules\Messaging\Support\CounterpartDesk;
use App\Modules\Messaging\Support\MessageInput;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class StartTenantConversationController
{
    public function __invoke(OpenTenantConversationRequest $request, TenantThreads $fils, StartExternalConversation $demarrer, CounterpartDesk $bureau, CurrentOrganization $contexte): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $aujourdhui = CarbonImmutable::today();
        $bail = $request->leaseId();

        foreach ($fils->keys($user->id, $aujourdhui) as $organisation => $cle) {
            if (in_array($bail, $cle['leases'], true)) {
                $demarre = $contexte->run((string) $organisation, fn () => $demarrer->handle($user, MessageSide::Tenant, new NewExternalConversationData(
                    ConversationKind::Tenant,
                    $cle['party'],
                    $bail,
                    null,
                    $request->subject(),
                    MessageInput::body($request),
                    MessageInput::attachments($request),
                    MessageInput::clientId($request),
                )));
                $fil = $fils->list($user->id, $aujourdhui)->whereKey($demarre->conversation->id)->firstOrFail();

                return $bureau->show($fil, $user, true)->response()->setStatusCode($demarre->replayed ? 200 : 201);
            }
        }

        throw ErrorCode::ConversationLinkNotFound->problem();
    }
}
