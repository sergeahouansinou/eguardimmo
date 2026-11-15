<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Models\SupportTicketMessage;
use App\Modules\Messaging\Support\AttachmentStore;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class PostSupportMessage
{
    /**
     * @param  list<UploadedFile>  $attachments
     */
    public function handle(SupportTicket $ticket, User $auteur, bool $fromSupport, bool $internal, string $body, array $attachments): SupportTicketMessage
    {
        $stockes = [];

        try {
            return DB::transaction(function () use ($ticket, $auteur, $fromSupport, $internal, $body, $attachments, &$stockes): SupportTicketMessage {
                $maintenant = now();
                $message = $ticket->messages()->create([
                    'author_user_id' => $auteur->id,
                    'from_support' => $fromSupport,
                    'internal' => $fromSupport && $internal,
                    'body' => $body,
                    'sent_at' => $maintenant,
                ]);

                foreach ($attachments as $fichier) {
                    $piece = AttachmentStore::store($fichier, 'support/'.$ticket->id);
                    $stockes[] = $piece['path'];
                    $message->attachments()->create($piece);
                }

                if (! $message->internal) {
                    $ticket->status = $fromSupport ? TicketStatus::Waiting : TicketStatus::Open;
                    $ticket->resolved_at = null;
                }

                if ($fromSupport && ! $message->internal && $ticket->first_response_at === null) {
                    $ticket->first_response_at = $maintenant;
                }

                $ticket->last_activity_at = $maintenant;
                $ticket->save();

                return $message;
            });
        } catch (Throwable $erreur) {
            Storage::disk(AttachmentStore::DISQUE)->delete($stockes);

            throw $erreur;
        }
    }
}
