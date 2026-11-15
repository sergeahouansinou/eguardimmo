<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Messaging\Models\ConversationParticipant;
use Illuminate\Support\Facades\DB;

final class SetConversationState
{
    public function handle(ConversationParticipant $participation, ?bool $lu, ?bool $archive): ConversationParticipant
    {
        return DB::transaction(function () use ($participation, $lu, $archive): ConversationParticipant {
            if ($lu !== null) {
                $participation->last_read_at = $lu ? now() : null;
            }

            if ($archive !== null) {
                $participation->archived_at = $archive ? now() : null;
            }

            $participation->save();

            return $participation;
        });
    }
}
