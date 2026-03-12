type JSONSchema = Record<string, unknown>;

export interface LlamaParseSchemaBuilderOptions {
  globalRules?: string[];
  documentTypeRules?: string[]; // Array of document type prompt strings
}

/**
 * Generic schema builder for LlamaParse extraction.
 * Can be used in any application by providing custom prompts and rules.
 * 
 * Example usage in another app:
 * ```ts
 * const builder = new LlamaParseSchemaBuilder({
 *   globalRules: ["Your custom rules here"],
 *   documentTypeRules: ["Your document type prompts here"]
 * });
 * const schema = builder.buildDealsV3ExtractionSchema();
 * ```
 */
export class LlamaParseSchemaBuilder {
  private readonly globalRules: string;
  private readonly documentTypeRules: string;

  constructor(options?: LlamaParseSchemaBuilderOptions) {
    this.globalRules = options?.globalRules?.join(" ") || [
      "Transaction Overview: extract Sources/Uses and preserve source fidelity; do not invent values.",
      "Property Metrics: capture GSF/NRA/NSF/ZFA/FAR/zoning and land metrics.",
      "Data Types: years as plain numbers, currency as raw numeric values, percentages as raw percent values.",
      "Conditional Logic: only extract conditionally-visible fields based on transaction_type/legal_structure/asset_physical_status.",
    ].join(" ");

    this.documentTypeRules = options?.documentTypeRules?.join("\n\n") || "";
  }

  /**
   * Set document type rules (prompts) for the schema.
   * This allows the schema builder to be used in other apps by providing custom prompts.
   */
  setDocumentTypeRules(rules: string[]): void {
    (this as any).documentTypeRules = rules.join("\n\n");
  }

  /**
   * Set global rules for the schema.
   */
  setGlobalRules(rules: string[]): void {
    (this as any).globalRules = rules.join(" ");
  }

  buildDealsV3ExtractionSchema(): JSONSchema {
    const properties: Record<string, unknown> = {
      deal_name:{
        type: ["string", "null"],
        description: "The name of the deal",
      },deal_description:{
        type: ["string", "null"],
        description: "A summary of the deal",
      },entry_type:{
        type: ["string", "null"],
        description: "The type of entry for the deal",
        enum: ["Single Asset", "Portfolio"],
      },strategy:{
        type: ["string", "null"],
        description: "The strategy of the deal",
        enum: ["Core", "Core Plus", "Value-Add", "Opportunistic"],
      },legal_structure:{
        type: ["string", "null"],
        description: "The legal structure of the deal",
        enum: ["Fee Simple", "Leasehold", "Note"],
      },target_hold_period:{
        type: ["string", "null"],
        description: "The target hold period of the deal in years",
        enum: ["1","3","5","7","10","30","Indefinite"],
      },sponsor_profile:{
        type: ["object", "null"],
        additionalProperties: true,
        properties: {
          name: {
            type: ["string", "null"],
            description: "The name of the sponsor",
          },
          email: {
            type: ["string", "null"],
            description: "The email of the sponsor",
          },
        },
      },associated_contacts:{
        description: "A list of contacts associated with the deal",
        anyOf: [
          {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true,
              properties: {
                name: {
                  type: ["string", "null"],
                  description: "The name of the contact",
                },
                email: {
                  type: ["string", "null"],
                  description: "The email of the contact",
                },
                role: {
                  type: ["string", "null"],
                  description: "The role or relationship of the contact to the deal",
                },
              },
            },
          },
          {
            type: "null",
          },
        ],
      },property_type:{
        type: ["string", "null"],
        description: "The type of property for the deal",
        enum: ["Assemblage","Healthcare","Hospitality","Industrial","Land","Mixed-Use","Multifamily","Office","Retail","Single-Family Residence (SFR)","Special-Purpose"],
      },subproperty_type:{
        type: ["string", "null"],
        description: `The type of subproperty for the deal. Here is a list of possible values based on the value of property_type:
            1. Assemblage
            Adjoining Lot, Assemblage, Contiguous, Future Development, Land Acquisition, Multiple Parcels, Parcel, Redevelopment, Zoning Change, Rezoning
            2. Healthcare
            AL (Assisted Living), Ambulatory Surgery Center (ASC), Anti-Kickback, CCRC (Continuum of Care Retirement Community), Clinical Space, Health System, Hospital-Affiliated, IL (Independent Living), Licensed Beds, MC (Memory Care), Medicaid, Medical Office Building (MOB), Medicare, Outpatient, Private Pay, Procedure Rooms, Senior Housing, SNF (Skilled Nursing Facility), Stark Law
            3. Hospitality
            ADR (Average Daily Rate), Banquet, FF&E (Furniture, Fixtures, and Equipment), Flag, Franchise Agreement, Full-Service, Limited-Service, Meeting Space, Number of Keys, Occupancy Rate, PIP (Property Improvement Plan), RevPAR (Revenue Per Available Room), Select-Service, STR Report (Smith Travel Research), Total Keys
            4. Industrial
            Clear Height, Climate-Controlled, Column Spacing, Distribution Center, Dock Doors, Dock-High Doors, Drive-In Doors, Drive-Up Access, ESFR (Early Suppression, Fast Response sprinklers), Flex Space, Grade-Level Doors, Logistics, Net Rentable Square Feet, Roll-Up Doors, Self-Storage, Truck Court, Warehouse
            5. Land
            Acreage, Acres, Entitled Land, Entitlements, FAR (Floor Area Ratio), Ground Lease, Outparcel, Pad Site, Raw Land, Shovel-Ready, Topography, Unimproved Land, Utilities to Site, Zoned R-3, Zoning
            6. Mixed-Use
            Commercial Space, Ground-Floor Retail, Live-Work-Play, Master Plan, Multifamily over Retail, Parking Garage, PUD (Planned Unit Development), Residential Units, Vertical Mixed-Use
            7. Multi-Family
            Average Rent per Unit, By-the-Bed Leases, Economic Occupancy, Effective Gross Income (EGI), Garden-Style, High-Rise, Lease-Up, Leasing Velocity, Loss to Lease, Mid-Rise, Net Rental Income, Number of Beds, Pre-Leasing, Rent per Bed, Rent Roll, Student Housing, Unit Mix
            8. Office
            Anchor Tenant, Class A/B/C, Common Area Maintenance (CAM), Core Factor, Credit Tenant, Full-Service Gross (FSG), Leasing Commissions (LCs), Load Factor, Modified Gross (MG), Net Rentable Area (NRA), Parking Ratio, Tenant Improvements (TIs), Usable Square Feet (USF)
            9. Retail
            Anchor Tenant, Co-Tenancy Clause, End-Cap, Frontage, Grocery-Anchored, In-line Tenant, Neighborhood Center, Overage Rent, Pad Site, Percentage Rent, Power Center, QSR (Quick-Service Restaurant), Sales per Square Foot (Sales PSF), Strip Center, Triple Net (NNN), Visibility
            10. Single-Family Residence (SFR)
            Average Rent, BTR (Build-to-Rent), Home, Houses, Portfolio, Scattered Site, SFR, Single-Family Rental
            11. Special Purpose
            Car Wash, Church, Campus, Data Center, Golf Course, Government Building, Marina, Parking Garage, Place of Worship, Post Office, School, Theater, University, Winery, Brewery
            `,
        enum: [
          "Adjoining Lot",
          "Assemblage",
          "Contiguous",
          "Future Development",
          "Land Acquisition",
          "Multiple Parcels",
          "Parcel",
          "Redevelopment",
          "Zoning Change",
          "Rezoning",
          "AL (Assisted Living)",
          "Ambulatory Surgery Center (ASC)",
          "Anti-Kickback",
          "CCRC (Continuum of Care Retirement Community)",
          "Clinical Space",
          "Health System",
          "Hospital-Affiliated",
          "IL (Independent Living)",
          "Licensed Beds",
          "MC (Memory Care)",
          "Medicaid",
          "Medical Office Building (MOB)",
          "Medicare",
          "Outpatient",
          "Private Pay",
          "Procedure Rooms",
          "Senior Housing",
          "SNF (Skilled Nursing Facility)",
          "Stark Law",
          "ADR (Average Daily Rate)",
          "Banquet",
          "FF&E (Furniture, Fixtures, and Equipment)",
          "Flag",
          "Franchise Agreement",
          "Full-Service",
          "Limited-Service",
          "Meeting Space",
          "Number of Keys",
          "Occupancy Rate",
          "PIP (Property Improvement Plan)",
          "RevPAR (Revenue Per Available Room)",
          "Select-Service",
          "STR Report (Smith Travel Research)",
          "Total Keys",
          "Clear Height",
          "Climate-Controlled",
          "Column Spacing",
          "Distribution Center",
          "Dock Doors",
          "Dock-High Doors",
          "Drive-In Doors",
          "Drive-Up Access",
          "ESFR (Early Suppression, Fast Response sprinklers)",
          "Flex Space",
          "Grade-Level Doors",
          "Logistics",
          "Net Rentable Square Feet",
          "Roll-Up Doors",
          "Self-Storage",
          "Truck Court",
          "Warehouse",
          "Acreage",
          "Acres",
          "Entitled Land",
          "Entitlements",
          "FAR (Floor Area Ratio)",
          "Ground Lease",
          "Outparcel",
          "Pad Site",
          "Raw Land",
          "Shovel-Ready",
          "Topography",
          "Unimproved Land",
          "Utilities to Site",
          "Zoned R-3",
          "Zoning",
          "Commercial Space",
          "Ground-Floor Retail",
          "Live-Work-Play",
          "Master Plan",
          "Multifamily over Retail",
          "Parking Garage",
          "PUD (Planned Unit Development)",
          "Residential Units",
          "Vertical Mixed-Use",
          "Average Rent per Unit",
          "By-the-Bed Leases",
          "Economic Occupancy",
          "Effective Gross Income (EGI)",
          "Garden-Style",
          "High-Rise",
          "Lease-Up",
          "Leasing Velocity",
          "Loss to Lease",
          "Mid-Rise",
          "Net Rental Income",
          "Number of Beds",
          "Pre-Leasing",
          "Rent per Bed",
          "Rent Roll",
          "Student Housing",
          "Unit Mix",
          "Anchor Tenant",
          "Class A/B/C",
          "Common Area Maintenance (CAM)",
          "Core Factor",
          "Credit Tenant",
          "Full-Service Gross (FSG)",
          "Leasing Commissions (LCs)",
          "Load Factor",
          "Modified Gross (MG)",
          "Net Rentable Area (NRA)",
          "Parking Ratio",
          "Tenant Improvements (TIs)",
          "Usable Square Feet (USF)",
          "Co-Tenancy Clause",
          "End-Cap",
          "Frontage",
          "Grocery-Anchored",
          "In-line Tenant",
          "Neighborhood Center",
          "Overage Rent",
          "Percentage Rent",
          "Power Center",
          "QSR (Quick-Service Restaurant)",
          "Sales per Square Foot (Sales PSF)",
          "Strip Center",
          "Triple Net (NNN)",
          "Visibility",
          "Average Rent",
          "BTR (Build-to-Rent)",
          "Home",
          "Houses",
          "Portfolio",
          "Scattered Site",
          "SFR",
          "Single-Family Rental",
          "Car Wash",
          "Church",
          "Campus",
          "Data Center",
          "Golf Course",
          "Government Building",
          "Marina",
          "Parking Garage",
          "Place of Worship",
          "Post Office",
          "School",
          "Theater",
          "University",
          "Winery",
          "Brewery",
        ],
      },asset_physical_status:{
        type: ["string", "null"],
        description: "The physical status of the asset",
        enum: ["Ground-Up", "Stabilized", "Value-Add"],
      },property_data:{
        type: "object",
        additionalProperties: true,
        properties: {
          address:{
            type: ["string", "null"],
            description: "The address of the property",
          },
          city:{
            type: ["string", "null"],
            description: "The city of the property",
          },
          state:{
            type: ["string", "null"],
            description: "The state of the property",
          },
          zipcode:{
            type: ["string", "null"],
            description: "The zipcode of the property",
          },
          nsf:{
            type: ["integer","null"],
            description: "The NSF (Net Square Footage) of the property",
          }
        },
      },preformance:{
        type: "object",
        additionalProperties: true,
        properties: {
          target_irr:{
            type: ["number","null"],
            description: "The target IRR of the deal. This value should be a percentage value between 0 and 100.",
          },
          target_em:{
            type: ["number","null"],
            description: "The target equity multiple of the deal. This value should be a decimal number value greater than 0.",
          }
        },project_costs:{
          type: "object",
          additionalProperties: true,
          properties: {
            aquisition_price:{
              type: ["number","null"],
              description: "The acquisition price of the deal",
            },
            hard_cost:{
              type: ["number","null"],
              description: "The hard cost of the deal",
            },
            soft_cost:{
              type: ["number","null"],
              description: "The soft cost of the deal",
            },
            financing_cost:{
              type: ["number","null"],
              description: "The financing cost of the deal",
            },
          },capital_stack:{
            type: "object",
            additionalProperties: true,
            properties: {
              senior_debt:{
                type: ["string","null"],
                description: "The senior debt of the deal",
                enum: ["A-Note","Bridge Financing","First Lien","First Mortgage","General Debt","Secured Loan","Stretch Senior","Whole Loan Purchase"],
              },limited_partner:{
                type: ["string","null"],
                description: "The limited partner of the deal",
                enum: ["Institutional Capital","Limited Partner","LP","LP Equity","Non-Control Investor","Passive Equity"],
              },general_partner:{
                type: ["string","null"],
                description: "The general partner of the deal",
                enum: ["Co-GP","General Partner","GP","GP Equity","Management Interest","Promote","Sponsor"],
              },ask_amount:{
                type: ["number","null"],
                description: "The ask amount of the deal",
              },ask_capital_position:{  
                description: "The ask capital position(s) of the deal. Multiple positions may be selected.",
                anyOf: [
                  {
                    type: "array",
                    items: {
                      type: "string",
                      enum: [
                        "Common Equity",
                        "General Partner",
                        "Joint Venture",
                        "Limited Partner",
                        "Mezzanine",
                        "Preferred Equity",
                        "Senior Debt",
                        "Stretch Senior Debt",
                      ],
                    },
                  },
                  {
                    type: "null",
                  },
                ],
              }
            },
          }
        }
      }
    };

    return {
      type: "object",
      additionalProperties: true,
      description: this.buildRootDescription(), // Include document-type rules ONCE at root level
      properties,
    };
  }

  /**
   * Build the root schema description that includes document-type rules.
   * This is called ONCE for the entire schema, not per-field.
   */
  private buildRootDescription(): string {
    return [
      "Deals V3 extraction schema.",
      this.globalRules,
      "Document-type rules:",
      this.documentTypeRules,
    ].join("\n\n");
  }
}

