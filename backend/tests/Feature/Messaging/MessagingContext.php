<?php

declare(strict_types=1);

namespace Tests\Feature\Messaging;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Models\Lease;
use App\Modules\Messaging\Actions\PostConversationMessage;
use App\Modules\Messaging\Actions\StartExternalConversation;
use App\Modules\Messaging\Data\NewExternalConversationData;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Messaging\Support\Participations;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Money\Money;
use Tests\Feature\Leases\LeasesContext as L;

final class MessagingContext
{
    public static function cle(): string
    {
        return (string) Str::uuid();
    }

    /**
     * Fil locataire ouvert par l'équipe.
     *
     * @param  array{party: Party, lease: Lease}  $locataire
     */
    public static function filLocataire(Organization $organisation, User $equipe, array $locataire, string $sujet = 'Quittance de novembre', string $corps = 'Bonjour, voici votre quittance.'): Conversation
    {
        return L::dans($organisation, fn (): Conversation => app(StartExternalConversation::class)->handle($equipe, MessageSide::Staff, new NewExternalConversationData(
            ConversationKind::Tenant, $locataire['party']->id, $locataire['lease']->id, null, $sujet, $corps, [], self::cle(),
        ))->conversation);
    }

    public static function filMandant(Organization $organisation, User $equipe, string $mandant, string $sujet = 'Relevé de gestion', string $corps = 'Bonjour, votre relevé est disponible.'): Conversation
    {
        return L::dans($organisation, fn (): Conversation => app(StartExternalConversation::class)->handle($equipe, MessageSide::Staff, new NewExternalConversationData(
            ConversationKind::Owner, $mandant, null, null, $sujet, $corps, [], self::cle(),
        ))->conversation);
    }

    public static function repondre(Organization $organisation, User $auteur, Conversation $fil, string $corps, MessageSide $cote = MessageSide::Staff): ConversationMessage
    {
        return L::dans($organisation, fn (): ConversationMessage => app(PostConversationMessage::class)->handle($fil, $auteur, $cote, $corps, [], self::cle())->message);
    }

    public static function lire(Organization $organisation, User $compte, Conversation $fil, MessageSide $cote): void
    {
        L::dans($organisation, function () use ($compte, $fil, $cote): void {
            $participation = Participations::of($fil, $compte->id, $cote);
            $participation->last_read_at = now()->toImmutable();
            $participation->save();
        });
    }

    /**
     * Solde non nul du compte `OwnerPayable` du mandant : la réponse reste permise pendant la grâce (ADR 0032).
     */
    public static function crediterMandant(Organization $organisation, string $mandant, int $centimes = 100000): void
    {
        L::dans($organisation, fn () => app(Ledger::class)->post(new EntryData(
            Journal::Bank, CarbonImmutable::today(), 'Encaissement pour le mandant', SourceType::Payment, (string) Str::uuid7(), 'msg-'.Str::random(8),
            [LineData::debit(AccountRole::Bank, Money::EUR($centimes)), LineData::credit(AccountRole::OwnerPayable, Money::EUR($centimes), null, $mandant)],
        )));
    }
}
