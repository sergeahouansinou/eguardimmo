<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Events\SupportTicketReplied;
use App\Modules\Messaging\Models\SupportAttachment;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Models\SupportTicketMessage;
use App\Modules\Messaging\Support\AttachmentStore;
use App\Modules\Messaging\Support\SupportRules;
use App\Shared\Audit\PreciseTimestamp;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Rejouable : un `client_id` déjà reçu du même auteur rend le message existant sans rien écrire, sans pièce stockée deux fois ni événement
 * réémis. Le demandeur ne rouvre une demande résolue que pendant 14 jours.
 */
final class PostSupportMessage
{
    /**
     * @param  list<UploadedFile>  $attachments
     */
    public function handle(SupportTicket $ticket, User $auteur, bool $fromSupport, bool $internal, string $body, array $attachments, ?string $clientId = null): SupportTicketMessage
    {
        $existant = $this->rejeu($ticket, $auteur, $internal, $body, $attachments, $clientId);

        if ($existant !== null) {
            return $existant;
        }

        $stockes = [];

        try {
            return DB::transaction(fn (): SupportTicketMessage => $this->poster($ticket->id, $auteur, $fromSupport, $internal, $body, $attachments, $clientId, $stockes));
        } catch (UniqueConstraintViolationException $erreur) {
            Storage::disk(AttachmentStore::DISQUE)->delete($stockes);

            return $this->rejeu($ticket, $auteur, $internal, $body, $attachments, $clientId) ?? throw $erreur;
        } catch (Throwable $erreur) {
            Storage::disk(AttachmentStore::DISQUE)->delete($stockes);

            throw $erreur;
        }
    }

    /**
     * @param  list<UploadedFile>  $attachments
     * @param  list<string>  $stockes
     */
    private function poster(string $ticketId, User $auteur, bool $fromSupport, bool $internal, string $body, array $attachments, ?string $clientId, array &$stockes): SupportTicketMessage
    {
        $ticket = SupportTicket::query()->whereKey($ticketId)->lockForUpdate()->firstOrFail();

        if (! $fromSupport && $ticket->status === TicketStatus::Resolved && $ticket->resolved_at?->lt(now()->subDays(SupportRules::REOUVERTURE_JOURS)) === true) {
            throw ErrorCode::TicketResolved->problem();
        }

        $maintenant = now();
        $message = $ticket->messages()->create([
            'author_user_id' => $auteur->id,
            'from_support' => $fromSupport,
            'internal' => $fromSupport && $internal,
            'client_id' => $clientId,
            'body' => $body,
            'sent_at' => $maintenant,
        ]);

        foreach ($attachments as $fichier) {
            $piece = AttachmentStore::store($fichier, 'support/'.$ticket->id);
            $stockes[] = $piece['path'];
            $message->attachments()->create($piece);
        }

        if (! $message->internal) {
            $ticket->moveTo($fromSupport ? TicketStatus::Waiting : TicketStatus::Open);
            $ticket->resolved_at = null;
            $ticket->last_activity_at = $maintenant;

            if ($fromSupport) {
                $ticket->support_last_read_at = $maintenant;
                $ticket->first_response_at ??= $maintenant;
            } else {
                $ticket->requester_last_read_at = $maintenant;
            }

            $ticket->save();
        }

        if ($fromSupport && ! $message->internal) {
            SupportTicketReplied::dispatch($ticket->id, $ticket->requester_user_id, $ticket->requester_last_read_at?->format(PreciseTimestamp::FORMAT) ?? 'never');
        }

        return $message;
    }

    /**
     * @param  list<UploadedFile>  $attachments
     */
    public function matches(SupportTicketMessage $message, bool $internal, string $body, array $attachments): bool
    {
        $recues = array_map(fn (UploadedFile $fichier): string => AttachmentStore::displayName($fichier).'|'.(int) $fichier->getSize(), $attachments);
        $stockees = $message->attachments()->get()->map(fn (SupportAttachment $piece): string => $piece->original_name.'|'.$piece->size_bytes)->all();
        sort($recues);
        sort($stockees);

        return $message->body === $body && $message->internal === ($message->from_support && $internal) && $recues === $stockees;
    }

    /**
     * @param  list<UploadedFile>  $attachments
     */
    private function rejeu(SupportTicket $ticket, User $auteur, bool $internal, string $body, array $attachments, ?string $clientId): ?SupportTicketMessage
    {
        if ($clientId === null) {
            return null;
        }

        $message = SupportTicketMessage::query()
            ->where('support_ticket_id', $ticket->id)
            ->where('author_user_id', $auteur->id)
            ->where('client_id', $clientId)
            ->first();

        if ($message !== null && ! $this->matches($message, $internal, $body, $attachments)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $message;
    }
}
