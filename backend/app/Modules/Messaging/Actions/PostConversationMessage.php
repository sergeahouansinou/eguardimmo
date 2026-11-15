<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Messaging\Support\AttachmentStore;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class PostConversationMessage
{
    /**
     * @param  list<UploadedFile>  $attachments
     */
    public function handle(Conversation $conversation, User $auteur, string $body, array $attachments): ConversationMessage
    {
        $stockes = [];

        try {
            return DB::transaction(function () use ($conversation, $auteur, $body, $attachments, &$stockes): ConversationMessage {
                $maintenant = now();
                $message = $conversation->messages()->create([
                    'author_user_id' => $auteur->id,
                    'body' => $body,
                    'sent_at' => $maintenant,
                ]);

                foreach ($attachments as $fichier) {
                    $piece = AttachmentStore::store($fichier, 'conversations/'.$conversation->organization_id.'/'.$conversation->id);
                    $stockes[] = $piece['path'];
                    $message->attachments()->create($piece);
                }

                $conversation->forceFill(['last_message_at' => $maintenant, 'last_author_user_id' => $auteur->id])->save();
                $conversation->participants()->update(['archived_at' => null]);
                $conversation->participants()->where('user_id', $auteur->id)->update(['last_read_at' => $maintenant->format('Y-m-d H:i:s.u')]);

                return $message;
            });
        } catch (Throwable $erreur) {
            Storage::disk(AttachmentStore::DISQUE)->delete($stockes);

            throw $erreur;
        }
    }
}
