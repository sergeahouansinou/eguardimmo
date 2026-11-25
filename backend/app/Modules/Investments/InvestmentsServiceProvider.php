<?php

declare(strict_types=1);

namespace App\Modules\Investments;

use App\Modules\Investments\Http\Middleware\PrivateResponse;
use App\Modules\Investments\Http\Middleware\RequireLandlordOrganization;
use App\Modules\Investments\Models\Loan;
use App\Modules\Investments\Models\LoanFee;
use App\Modules\Investments\Models\LoanInterestAttestation;
use App\Modules\Investments\Models\LoanSchedule;
use App\Modules\Investments\Models\LoanScheduleLine;
use App\Modules\Investments\Models\LoanUsage;
use App\Modules\Investments\Models\PropertyAcquisition;
use App\Shared\Http\RateLimitIp;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

final class InvestmentsServiceProvider extends ServiceProvider
{
    public function boot(Router $routeur): void
    {
        $routeur->aliasMiddleware('investments.private', PrivateResponse::class);
        $routeur->aliasMiddleware('investments.landlord', RequireLandlordOrganization::class);

        RateLimiter::for('investments-import', fn (Request $requete): Limit => Limit::perHour(30)->by('investments-import:'.(string) $requete->route('organization').':'.(string) ($requete->user()?->getAuthIdentifier() ?? RateLimitIp::of($requete))));

        Relation::enforceMorphMap([
            'property_acquisition' => PropertyAcquisition::class,
            'loan' => Loan::class,
            'loan_schedule' => LoanSchedule::class,
            'loan_schedule_line' => LoanScheduleLine::class,
            'loan_fee' => LoanFee::class,
            'loan_interest_attestation' => LoanInterestAttestation::class,
            'loan_usage' => LoanUsage::class,
        ]);
    }
}
