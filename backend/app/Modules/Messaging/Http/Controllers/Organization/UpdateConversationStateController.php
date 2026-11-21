<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\SetConversationState;
use App\Modules\Messaging\Http\Requests\UpdateExternalConversationRequest;
use App\Modules\Messaging\Http\Resources\ConversationSummaryResource;
use App\Modules\Messaging\Queries\StaffThreads;
use App\Modules\Messaging\Support\ConversationLoader;
use App\Modules\Messaging\Support\StaffAccess;
use App\Modules\Messaging\Support\StaffDesk;
use Illuminate\Http\Resources\Json\JsonResource;

final class UpdateConversationStateController
{
    public function __invoke(UpdateExternalConversationRequest $request, string $conversation, SetConversationState $etat, StaffThreads $fils, StaffDesk $bureau, StaffAccess $acces): JsonResource
    {
        /** @var User $user */
        $user = $request->user();
        $externe = $fils->find($user->id, $conversation);

        if ($externe === null) {
            return new ConversationSummaryResource($etat->handle(ConversationLoader::participation($request, $conversation), $request->read(), $request->archived()));
        }

        $acces->assertExternal($user, $externe->kind);

        if ($request->read() !== null || $request->archived() !== null) {
            $bureau->mark($externe, $user, $request->read(), $request->archived());
        }

        $bureau->update($externe, $user, $request->status(), $request->assigns(), $request->assigneeId());

        return $bureau->show($bureau->fresh($user, $conversation), $user, 1);
    }
}
