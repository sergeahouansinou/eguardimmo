<?php

declare(strict_types=1);

namespace Tests\Feature\Notifications;

use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Enums\TenantInvitationStatus;
use App\Modules\Identity\Enums\TenantRevoker;
use App\Modules\Identity\Models\TenantInvitation;
use App\Modules\Identity\Models\User;
use App\Modules\Listings\Enums\LeadStatus;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\Listing;
use App\Modules\Listings\Models\ListingLead;
use App\Modules\Notifications\Enums\ReminderCode;
use App\Modules\Notifications\Models\ReminderRule;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Properties\Models\Property;
use App\Modules\Recovery\Enums\ActType;
use App\Modules\Recovery\Enums\CaseStatus;
use App\Modules\Recovery\Models\RecoveryAct;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\RentSchedule;
use App\Modules\Subscriptions\Enums\SubscriptionStatus;
use App\Modules\Subscriptions\Models\Subscription;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Support\Facades\Artisan;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Tenant\TenantContext;

/**
 * Un cas éligible par rappel, construit à sa date de départ, avec de quoi le rendre non éligible.
 */
final class ReminderScenarios
{
    public const string MAINTENANT = '2026-11-25 09:00:00';

    public static function maintenant(): CarbonImmutable
    {
        return CarbonImmutable::parse(self::MAINTENANT);
    }

    /**
     * @return array{eligible: CarbonImmutable, hors: list<CarbonImmutable>} départs pour les réglages par défaut
     */
    public static function departs(ReminderCode $code): array
    {
        $maintenant = self::maintenant();
        ['delay' => $delai, 'repeat' => $repetition, 'occurrences' => $occurrences] = $code->defaults();

        if ($code === ReminderCode::RentDueSoon) {
            return ['eligible' => $maintenant->addDays($delai), 'hors' => [$maintenant->addDays($delai + 1), $maintenant->subDay()]];
        }

        if ($code === ReminderCode::TrialEnding) {
            return ['eligible' => $maintenant->addDays($delai)->subHour(), 'hors' => [$maintenant->addDays($delai)->addHour(), $maintenant->subHour()]];
        }

        $profondeur = $delai + (int) $repetition * ($occurrences - 1) + 7;

        return [
            'eligible' => $maintenant->subDays($delai)->subHour(),
            'hors' => [$maintenant->subDays($delai - 1), $maintenant->subDays($profondeur + 2)],
        ];
    }

    /**
     * @param  array<string, mixed>  $surcharges
     */
    public static function activer(ReminderCode $code, array $surcharges = []): ReminderRule
    {
        $defauts = $code->defaults();

        return ReminderRule::query()->forceCreate([
            'code' => $code,
            'enabled' => true,
            'delay_days' => $defauts['delay'],
            'repeat_every_days' => $defauts['repeat'],
            'max_occurrences' => $defauts['occurrences'],
            'channels' => array_map(fn ($canal): string => $canal->value, $code->availableChannels()),
            ...$surcharges,
        ]);
    }

    /**
     * @return array{destinataire: User, organisation: Organization|null, annuler: Closure(): mixed}
     */
    public static function semer(mixed $test, ReminderCode $code, CarbonImmutable $depart): array
    {
        $creation = $depart->min(self::maintenant());
        $test->travelTo($creation);
        $cas = self::{$code->value}($test, $depart);
        $test->travelTo(self::maintenant());

        return $cas;
    }

    private static function account_inactive(mixed $test, CarbonImmutable $depart): array
    {
        $compte = User::factory()->create(['created_at' => $depart->subDays(90), 'last_login_at' => $depart]);

        return self::cas($compte, null, fn () => $compte->forceFill(['last_login_at' => now()])->save());
    }

    private static function email_unverified(mixed $test, CarbonImmutable $depart): array
    {
        $compte = User::factory()->unverified()->create(['created_at' => $depart]);

        return self::cas($compte, null, fn () => $compte->forceFill(['email_verified_at' => now()])->save());
    }

    private static function space_not_created(mixed $test, CarbonImmutable $depart): array
    {
        $compte = User::factory()->create(['email_verified_at' => $depart]);

        return self::cas($compte, null, fn () => $compte->forceFill(['intended_profile' => IntendedProfile::Traveler])->save());
    }

    private static function agency_not_created(mixed $test, CarbonImmutable $depart): array
    {
        $compte = User::factory()->create(['email_verified_at' => $depart, 'intended_profile' => IntendedProfile::Agency]);

        return self::cas($compte, null, fn () => self::rejoindre(TenantContext::organisation(), $compte, MemberRole::Manager));
    }

    private static function landlord_space_not_created(mixed $test, CarbonImmutable $depart): array
    {
        $compte = User::factory()->create(['email_verified_at' => $depart, 'intended_profile' => IntendedProfile::IndividualLandlord]);

        return self::cas($compte, null, function () use ($compte): void {
            activerDeuxFacteurs($compte);
            app(CreateOrganization::class)->handle($compte, new NewOrganizationData(OrganizationKind::Individual, 'Bailleur Diallo', 'FR'), 'Awa', 'Diallo');
        });
    }

    private static function property_missing(mixed $test, CarbonImmutable $depart): array
    {
        $organisation = TenantContext::organisation();

        return self::cas(L::titulaire($organisation), $organisation, fn () => L::dans($organisation, fn () => Property::factory()->create()));
    }

    private static function listing_missing(mixed $test, CarbonImmutable $depart): array
    {
        $organisation = TenantContext::organisation();

        return self::cas(L::titulaire($organisation), $organisation, fn () => L::dans($organisation, fn () => Listing::factory()->create()));
    }

    private static function listing_draft(mixed $test, CarbonImmutable $depart): array
    {
        $organisation = TenantContext::organisation();
        $annonce = L::dans($organisation, fn (): Listing => Listing::factory()->create());

        return self::cas(L::titulaire($organisation), $organisation, fn () => L::dans($organisation, fn () => $annonce->forceFill(['status' => ListingStatus::Published, 'published_at' => now()])->save()));
    }

    private static function lead_unanswered(mixed $test, CarbonImmutable $depart): array
    {
        $organisation = TenantContext::organisation();
        $demande = L::dans($organisation, function (): ListingLead {
            $demande = (new ListingLead)->forceFill([
                'listing_id' => Listing::factory()->published()->create()->id,
                'user_id' => User::factory()->create()->id,
                'requested_slot' => 'Samedi matin',
                'status' => LeadStatus::New,
            ]);
            $demande->save();

            return $demande;
        });

        return self::cas(L::titulaire($organisation), $organisation, fn () => L::dans($organisation, fn () => $demande->forceFill(['status' => LeadStatus::Answered])->save()));
    }

    private static function invitation_pending(mixed $test, CarbonImmutable $depart): array
    {
        $organisation = TenantContext::organisation();
        $partie = TenantContext::partie($organisation);
        $invitation = L::dans($organisation, function () use ($organisation, $partie, $depart): TenantInvitation {
            $invitation = (new TenantInvitation)->forceFill([
                'party_id' => $partie->id,
                'organization_name' => $organisation->name,
                'email' => 'locataire@exemple.fr',
                'token_hash' => hash('sha256', $partie->id),
                'status' => TenantInvitationStatus::Pending,
                'expires_at' => $depart->addDays(60),
                'invited_by_user_id' => $organisation->created_by_user_id,
            ]);
            $invitation->save();

            return $invitation;
        });

        return self::cas(L::titulaire($organisation), $organisation, fn () => L::dans($organisation, fn () => $invitation->forceFill([
            'status' => TenantInvitationStatus::Revoked, 'revoked_at' => now(), 'revoked_by' => TenantRevoker::Organization,
        ])->save()));
    }

    private static function recovery_stalled(mixed $test, CarbonImmutable $depart): array
    {
        $organisation = TenantContext::organisation();
        $locataire = TenantContext::locataire($organisation);
        $dossier = L::dans($organisation, fn (): RecoveryCase => RecoveryCase::query()->create([
            'number' => 'REC-0001',
            'lease_id' => $locataire['lease']->id,
            'debtor_party_id' => $locataire['party']->id,
            'status' => CaseStatus::Open,
            'currency' => 'EUR',
            'opened_on' => $depart->toDateString(),
        ]));

        return self::cas(L::titulaire($organisation), $organisation, fn () => L::dans($organisation, function () use ($dossier): void {
            (new RecoveryAct)->forceFill(['case_id' => $dossier->id, 'type' => ActType::Call, 'performed_on' => now()->toDateString()])->save();
        }));
    }

    private static function rent_due_soon(mixed $test, CarbonImmutable $depart): array
    {
        return self::echeance($depart, InstallmentStatus::Upcoming);
    }

    private static function rent_unpaid(mixed $test, CarbonImmutable $depart): array
    {
        return self::echeance($depart, InstallmentStatus::Issued);
    }

    private static function trial_ending(mixed $test, CarbonImmutable $depart): array
    {
        Artisan::call('subscriptions:seed-plans');
        $organisation = TenantContext::organisation();
        $essai = L::dans($organisation, fn (): Subscription => Subscription::query()->firstOrFail());
        L::dans($organisation, fn () => $essai->forceFill(['status' => SubscriptionStatus::Trialing, 'trial_ends_at' => $depart])->save());

        return self::cas(L::titulaire($organisation), $organisation, fn () => L::dans($organisation, fn () => $essai->forceFill(['status' => SubscriptionStatus::Free])->save()));
    }

    private static function echeance(CarbonImmutable $depart, InstallmentStatus $statut): array
    {
        $organisation = TenantContext::organisation();
        $locataire = TenantContext::locataire($organisation);
        L::dans($organisation, fn () => (new RentSchedule)->forceFill(['lease_id' => $locataire['lease']->id, 'billing_from' => '2026-01-01'])->save());
        $echeance = L::dans($organisation, fn (): Installment => Installment::factory()->create([
            'lease_id' => $locataire['lease']->id,
            'period_start' => $depart->startOfMonth()->toDateString(),
            'period_end' => $depart->endOfMonth()->toDateString(),
            'due_date' => $depart->toDateString(),
            'status' => $statut,
            'issued_on' => $statut === InstallmentStatus::Upcoming ? null : $depart->subDays(10)->toDateString(),
        ]));

        return self::cas($locataire['user'], $organisation, fn () => L::dans($organisation, fn () => $echeance->forceFill([
            'status' => InstallmentStatus::Paid, 'issued_on' => now()->toDateString(),
        ])->save()));
    }

    public static function rejoindre(Organization $organisation, User $compte, MemberRole $role): OrganizationMember
    {
        return L::dans($organisation, fn (): OrganizationMember => OrganizationMember::query()->create([
            'user_id' => $compte->id,
            'email' => mb_strtolower($compte->email),
            'first_name' => 'Marc',
            'last_name' => 'Chevalier',
            'role' => $role,
            'status' => MemberStatus::Active,
            'joined_at' => now(),
        ]));
    }

    /**
     * @return array{destinataire: User, organisation: Organization|null, annuler: Closure(): mixed}
     */
    private static function cas(User $destinataire, ?Organization $organisation, Closure $annuler): array
    {
        return ['destinataire' => $destinataire, 'organisation' => $organisation, 'annuler' => $annuler];
    }
}
