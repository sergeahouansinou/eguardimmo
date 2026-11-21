<?php

declare(strict_types=1);

namespace Tests\Feature\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Models\Organization;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\OwnerFunds\Notifications\PayoutAccountCodeNotification;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\Party;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReportingContext as X;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

final class OwnerPayoutContext
{
    public const string IBAN = 'FR7630006000011234567890189';

    public const string IBAN_BIS = 'DE89370400440532013000';

    public const string IBAN_HORS_JURIDICTION = 'GB29NWBK60161331926819';

    /**
     * Agence avec fonds de mandants actifs (compte de paiement `…4321`) et un compte propriétaire rattaché, 2FA confirmée.
     *
     * @return array{org: Organization, mandant: Party, bail: mixed, awa: User}
     */
    public static function scene(object $test): array
    {
        ['org' => $org, 'bail' => $bail, 'mandant' => $mandant] = F::agence($test);
        config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
        Notification::fake();
        $awa = X::rattacher($org, $mandant);
        activerDeuxFacteurs($awa);

        return ['org' => $org, 'mandant' => $mandant, 'bail' => $bail, 'awa' => $awa];
    }

    public static function pdf(): UploadedFile
    {
        return DocumentsContext::pdf('rib.pdf', DocumentsContext::PDF.'%'.bin2hex(random_bytes(8))."\n");
    }

    /**
     * @param  array<string, mixed>  $corps
     */
    public static function demander(object $test, User $compte, string $accessId, array $corps = [], bool $preuve = true, bool $limite = false): TestResponse
    {
        $limite || Cache::flush();
        if ($preuve) {
            O::preuve($test);
        }

        return O::comme($test, $compte)->post('/api/v1/owner/payout-account/requests', [
            'access_id' => $accessId,
            'iban' => self::IBAN,
            'holder_name' => 'Awa Diallo',
            'proof' => self::pdf(),
            ...$corps,
        ], [...O::ORIGINE, 'Accept' => 'application/json']);
    }

    public static function code(User $compte): string
    {
        $envois = Notification::sent($compte, PayoutAccountCodeNotification::class);

        return $envois->last()->code;
    }

    public static function confirmer(object $test, User $compte, string $demande, ?string $code = null, bool $preuve = false): TestResponse
    {
        if ($preuve) {
            O::preuve($test);
        }

        return O::comme($test, $compte)->postJson("/api/v1/owner/payout-account/requests/{$demande}/confirm", ['code' => $code ?? self::code($compte)], O::ORIGINE);
    }

    public static function acces(User $compte): string
    {
        return (string) O::comme(test(), $compte)->getJson('/api/v1/owner/payout-account')->assertOk()->json('data.0.access_id');
    }

    /**
     * Compte d'agence : demandes en attente, approbation ou refus.
     *
     * @param  array<string, mixed>  $corps
     */
    public static function trancher(object $test, Organization $org, string $demande, string $action, array $corps = []): TestResponse
    {
        O::comme($test, L::titulaire($org));

        return $test->postJson("/api/v1/org/{$org->id}/owner-funds/payout-account-requests/{$demande}/{$action}", $corps);
    }

    public static function version(string $demande): int
    {
        return (int) PayoutAccountRequest::query()->withoutGlobalScopes()->whereKey($demande)->value('lock_version');
    }

    /**
     * @return array<string, mixed>
     */
    public static function approbation(string $demande, ?string $iban = null, string $titulaire = 'Awa Diallo'): array
    {
        return ['lock_version' => self::version($demande), 'iban' => $iban ?? self::IBAN, 'holder_name' => $titulaire];
    }

    public static function lignes(string $partie): int
    {
        return BankAccount::query()->withoutGlobalScopes()->where('party_id', $partie)->count();
    }
}
