<?php

declare(strict_types=1);

use App\Modules\Identity\Actions\ConsumeOwnerInvitation;
use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\OwnerInvitationNotification;
use App\Modules\Parties\Models\OwnerAccess;
use App\Modules\Parties\Models\Party;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Notification::fake();
    L::semer();
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = L::titulaire($this->org);
    O::navigateurAgence($this);
    $this->mandant = O::mandant($this->org);
    O::mandat($this->org, $this->mandant);
    $this->compte = User::factory()->create(['email' => 'awa@exemple.fr']);

    $this->inviter = function (array $corps = []): array {
        O::preuve($this);
        $reponse = O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $this->mandant), ['role' => 'holder', 'identity_verified' => true, ...$corps])->assertCreated();
        $jeton = '';
        Notification::assertSentOnDemand(OwnerInvitationNotification::class, function (OwnerInvitationNotification $n) use (&$jeton): bool {
            $jeton = basename($n->acceptUrl);

            return true;
        });
        Notification::fake();

        return ['token' => $jeton, 'code' => (string) $reponse->json('data.pairing_code'), 'id' => (string) $reponse->json('data.invitation.id')];
    };
    $this->accepter = fn (array $invit, ?User $compte = null, ?string $code = null) => O::comme($this, $compte ?? $this->compte)
        ->withoutMiddleware(ThrottleRequests::class)
        ->postJson('/api/v1/owner-invitations/acceptance', ['token' => $invit['token'], 'code' => $code ?? $invit['code'], 'consent' => true]);
    $this->lignes = fn (): array => DB::table('owner_invitations')->orderBy('created_at')->get(['status', 'email'])->map(fn (object $l): array => [$l->status, $l->email])->all();
});

describe('adresse conservée seulement tant que l\'invitation est en attente', function (): void {
    it('garde l\'adresse en clair en attente, puis la remplace par son indice dès l\'acceptation', function (): void {
        $invit = ($this->inviter)();
        expect(($this->lignes)())->toBe([['pending', 'awa@exemple.fr']]);

        ($this->accepter)($invit)->assertCreated();

        expect(($this->lignes)())->toBe([['accepted', 'a***@exemple.fr']]);
    });

    it('la remplace à la révocation par l\'agence', function (): void {
        $invit = ($this->inviter)();
        O::comme($this, $this->titulaire)->deleteJson(O::urlAcces($this->org, $this->mandant, '/'.$invit['id']))->assertNoContent();

        expect(($this->lignes)())->toBe([['revoked', 'a***@exemple.fr']]);
    });

    it('la remplace sur l\'invitation remplacée par une réinvitation, et garde la nouvelle en clair', function (): void {
        ($this->inviter)();
        ($this->inviter)();

        expect(($this->lignes)())->toBe([['revoked', 'a***@exemple.fr'], ['pending', 'awa@exemple.fr']]);
    });

    it('la remplace à l\'expiration', function (): void {
        ($this->inviter)();
        $this->travelTo(now()->addDays(8));
        $this->artisan('identity:expire-owner-invitations')->assertSuccessful();

        expect(($this->lignes)())->toBe([['expired', 'a***@exemple.fr']]);
    });

    it('la remplace au blocage par cinq codes faux', function (): void {
        $invit = ($this->inviter)();
        $faux = $invit['code'] === '000000' ? '000001' : '000000';

        for ($i = 0; $i < 5; $i++) {
            ($this->accepter)($invit, null, $faux)->assertUnprocessable();
        }

        expect(($this->lignes)())->toBe([['blocked', 'a***@exemple.fr']]);
    });

    it('la remplace quand la fiche du mandant est anonymisée', function (): void {
        ($this->inviter)();
        O::preuve($this);
        O::comme($this, $this->titulaire)->postJson("/api/v1/org/{$this->org->id}/parties/{$this->mandant->id}/anonymization")->assertSuccessful();

        expect(($this->lignes)())->toBe([['revoked', 'a***@exemple.fr']]);
    });

    it('révoque et purge l\'invitation en attente d\'un compte supprimé, et ne laisse aucune adresse en clair', function (): void {
        ($this->inviter)();

        event(new AccountDeleted($this->compte->id));

        expect(($this->lignes)())->toBe([['revoked', 'a***@exemple.fr']]);
        expect(json_encode(DB::table('owner_invitations')->get(), JSON_THROW_ON_ERROR))->not->toContain('awa@exemple.fr');
    });

    it('ne laisse aucune adresse complète après une acceptation suivie de la suppression du compte', function (): void {
        $invit = ($this->inviter)();
        ($this->accepter)($invit)->assertCreated();

        event(new AccountDeleted($this->compte->id));

        expect(json_encode(DB::table('owner_invitations')->get(), JSON_THROW_ON_ERROR))->not->toContain('awa@exemple.fr');
        expect(L::dans($this->org, fn (): int => OwnerAccess::query()->where('status', 'active')->count()))->toBe(0);
    });
});

describe('ordre des verrous : fiche du mandant puis invitation', function (): void {
    $sequence = function (callable $appel): array {
        $suite = [];
        DB::listen(function (QueryExecuted $q) use (&$suite): void {
            $sql = $q->sql;
            if (str_contains($sql, 'from "parties"') && preg_match('/"id" = \?/', $sql) === 1) {
                $suite[] = 'P';
            } elseif (str_contains($sql, 'from "owner_invitations"') && ! str_contains($sql, 'token_hash') && preg_match('/"id" = \?/', $sql) === 1) {
                $suite[] = 'I';
            }
        });
        $appel();

        return $suite;
    };

    it('verrouille la fiche avant l\'invitation à l\'acceptation', function () use ($sequence): void {
        $invit = ($this->inviter)();

        $suite = $sequence(fn () => ($this->accepter)($invit)->assertCreated());

        $premiereP = array_search('P', $suite, true);
        $invitations = array_keys(array_filter($suite, fn (string $e): bool => $e === 'I'));
        expect($premiereP)->not->toBeFalse()->and(count($invitations))->toBeGreaterThanOrEqual(2)
            ->and($premiereP)->toBeLessThan($invitations[1]);
    });

    it('verrouille la fiche avant l\'invitation à l\'émission', function (): void {
        O::preuve($this);
        $suite = [];
        DB::listen(function (QueryExecuted $q) use (&$suite): void {
            if (str_contains($q->sql, 'from "parties"')) {
                $suite[] = 'P';
            } elseif (str_contains($q->sql, 'from "owner_invitations"')) {
                $suite[] = 'I';
            }
        });
        O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $this->mandant), ['role' => 'holder', 'identity_verified' => true])->assertCreated();

        expect(array_search('P', $suite, true))->toBeLessThan(array_search('I', $suite, true));
    });
});

it('refuse à l\'acceptation une fiche archivée, comme un jeton inconnu, sans rien consommer', function (): void {
    $invit = ($this->inviter)();
    L::dans($this->org, fn () => Party::query()->whereKey($this->mandant->id)->update(['archived_at' => now()]));

    $reponse = ($this->accepter)($invit)->assertNotFound()->assertJsonPath('code', 'owner_invitation_invalid');
    expect(L::dans($this->org, fn (): int => OwnerAccess::query()->count()))->toBe(0)->and(($this->lignes)())->toBe([['pending', 'awa@exemple.fr']]);
    expect($reponse->json('detail'))->toBe(($this->accepter)(['token' => str_repeat('z', 48), 'code' => '123456'])->json('detail'));

    L::dans($this->org, fn () => Party::query()->whereKey($this->mandant->id)->update(['archived_at' => null]));
    ($this->accepter)($invit)->assertCreated();
});

it('refuse à l\'acceptation la fiche archivée de la personne d\'un co-indivisaire', function (): void {
    $personne = T::partie($this->org);
    T::emailPrincipal($this->org, $personne, 'co@exemple.fr');
    $co = User::factory()->create(['email' => 'co@exemple.fr']);
    $invit = ($this->inviter)(['role' => 'co_owner', 'person_party_id' => $personne->id]);
    L::dans($this->org, fn () => Party::query()->whereKey($personne->id)->update(['archived_at' => now()]));

    ($this->accepter)($invit, $co)->assertNotFound()->assertJsonPath('code', 'owner_invitation_invalid');
    expect(L::dans($this->org, fn (): int => OwnerAccess::query()->count()))->toBe(0);
});

it('ne laisse qu\'un gagnant quand une autre acceptation passe entre la lecture du jeton et le verrou', function (): void {
    $invit = ($this->inviter)();
    $gagnant = User::factory()->create(['email' => 'gagnant@exemple.fr']);
    $declenche = false;
    DB::listen(function (QueryExecuted $q) use (&$declenche, $invit, $gagnant): void {
        if (! $declenche && str_contains($q->sql, 'from "owner_invitations"') && str_contains($q->sql, 'token_hash')) {
            $declenche = true;
            DB::table('owner_invitations')->where('id', $invit['id'])->update(['status' => 'accepted', 'token_hash' => null, 'code_hash' => null, 'accepted_by_user_id' => $gagnant->id, 'accepted_at' => now(), 'consent_version' => '2026-11']);
        }
    });

    try {
        app(ConsumeOwnerInvitation::class)->handle($this->compte->id, $invit['token'], $invit['code'], true);
        $refus = null;
    } catch (ApiProblem $e) {
        $refus = $e->problemCode;
    }

    expect($refus)->toBe('owner_invitation_invalid');

    expect(DB::table('owner_invitations')->where('id', $invit['id'])->value('accepted_by_user_id'))->toBe($gagnant->id);
});
