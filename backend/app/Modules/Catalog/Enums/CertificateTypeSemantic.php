<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Enums;

enum CertificateTypeSemantic: string
{
    case EnergyPerformance = 'energy_performance';
    case ProfessionalCard = 'professional_card';
    case FinancialGuarantee = 'financial_guarantee';
    case ProfessionalLiability = 'professional_liability';
    case HomeInsurance = 'home_insurance';
}
