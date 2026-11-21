<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Messaging\Models\ConversationParticipant;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class SetConversationState
{
    public function handle(ConversationParticipant $participation, ?bool $lu, ?bool $archive): ConversationParticipant
    {
        return DB::transaction(function () use ($participation, $lu, $archive): ConversationParticipant {
            if ($lu !== null) {
                $deja = $lu && $participation->last_read_at !== null && $participation->last_read_at->gte($participation->conversation->last_message_at);
                $participation->last_read_at = $lu ? ($deja ? $participation->last_read_at : CarbonImmutable::now()) : null;
            }

            if ($archive !== null) {
                $participation->archived_at = $archive ? CarbonImmutable::now() : null;
            }

            $participation->save();

            return $participation;
        });
    }
}
